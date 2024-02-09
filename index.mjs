import axios from 'axios';
import { ethers } from 'ethers';
import dotsMinterAbi from './dotsMinterAbi.mjs';
import engineContractAbi from './engineContractAbi.mjs';
import { config } from 'dotenv';

// Load environment variables
config();
const alchemyApiKey = process.env.ALCHEMY_API_KEY;
const graphQlUrl = process.env.AB_GRAPH_ENDPOINT;
const hasuraGraphQlUrl = process.env.HASURA_GRAPHQL_ENDPOINT;
const dotsMinterContract = process.env.DOTS_MINTER_CONTRACT_ADDRESS;
const secondaryContract = process.env.SECONDARY_CONTRACT_ADDRESS;
const secondaryProjectId = process.env.SECONDARY_PROJECT_ID;
const dotsContract = process.env.DOTS_CONTRACT_ADDRESS;
const dotsProjectId = process.env.DOTS_PROJECT_ID;
const pinataApiKey = process.env.PINATA_API_KEY;
const pinataSecretApiKey = process.env.PINATA_SECRET_API_KEY;
const privateKey = process.env.PRIVATE_KEY;
const rpcProviderUrl = process.env.RPC_PROVIDER_URL;

const provider = new ethers.providers.StaticJsonRpcProvider(`${rpcProviderUrl}/${alchemyApiKey}`);

// Create a wallet instance from a private key
let wallet = new ethers.Wallet(privateKey, provider);

// Create a contract instance
const dotsMinter = new ethers.Contract(dotsMinterContract, dotsMinterAbi, provider);
const secondaryEngineContract = new ethers.Contract(secondaryContract, engineContractAbi, provider);

const getProjectInfoQuery = `query GetCompositeDeps($projectId: String) {
    project(
          id: $projectId
    ) {
      id
      invocations
      projectId
      name
      contract {
        preferredIPFSGateway
      }
      externalAssetDependencies(first: 1) {
        cid
      }
    }
  }`;

  const getProjectTokensQuery = `query GetCompositeTokens($projectId: String, $lastTokenId: String) {
    project(
          id: $projectId
    ) {
        tokens(where: {invocation_gt: $lastTokenId}, first: 900) {
            id
            tokenId
        }
    }
  }`;

  const getDotsTokensQuery = `
  query GetDotsTokens($projectId: String, $dotTokenIds: [String]) {
    project(
          id: $projectId
    ) {
        tokens(where: {tokenId_in: $dotTokenIds}, first: 900) {
            hash
            tokenId
        }
    }
  }`;

  const refreshABTokensQuery = `
    mutation UpdateTokenMedia($tokenIds: [String], $features: Boolean!, $render: Boolean!, $renderVideo: Boolean) {
        updateTokenMedia(
          tokenIds: $tokenIds
          features: $features    
          render: $render
          renderVideo: $renderVideo
        ) {
          token_ids
          __typename
        }
    }
  `

  const fetchMessageFromApiGql = async (userAddress) => {
    const query = `
      query GetAuthMessage($publicAddress: String!, $domain: String!, $uri: String!) {
        getAuthMessage(publicAddress: $publicAddress, domain: $domain, uri: $uri) {
          authMessage
        }
      }
    `;
  
    const variables = {
      publicAddress: userAddress,
      domain: 'r4v3n.art',
      uri:'https://r4v3n.art/builder',
    };
  
    const result = await hasuraGraphQlCall(query, variables);
  
    if (!result || !result.data.data.getAuthMessage) {
      throw new Error("Failed to fetch auth message");
    }
  
    return result.data.data.getAuthMessage.authMessage;
  }
  
  const getJwtGql = async (userAddress) => {
    const address = ethers.utils.getAddress(userAddress);
    const message = await fetchMessageFromApiGql(address);
  
    let signature = await wallet.signMessage(message);
  
    const mutation = `
      mutation Authenticate($input: AuthenticateInput!) {
        authenticate(input: $input) {
          jwt
          expiration
        }
      }
    `;
  
    const variables = {
      input: {
        publicAddress: address,
        message,
        signature
      }
    };
  
    const result = await hasuraGraphQlCall(mutation, variables);
  
    if (!result || !result.data.data.authenticate) {
      throw new Error("Failed to fetch AB JWT");
    }
  
    return {
      jwt: result.data.data.authenticate.jwt,
      expiration: result.data.data.authenticate.expiration,
    };
}

const getRedeemedDotsFor = async (engineAddress, tokenId) => {
    try {
        // Call the `redeemedDotsFor` function
        const redeemedDots = await dotsMinter.redeemedDotsFor(engineAddress, tokenId);
        return redeemedDots;
    } catch (error) {
        console.error('Error:', error);
    }
}

const graphQlCall = async (query, variables) => {
    try {
        const response = await axios.post(graphQlUrl, {
            query,
            variables
        });

        return response;
    } catch (error) {
        console.error('Error fetching Graph data:', error);
        throw error; // or handle it as per your application's error handling policy
    }
}

const hasuraGraphQlCall = async (query, variables, jwt, operationName) => {
    const headers = jwt ? { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json", 'x-hasura-role': 'allowlisted' } : {};

    try {
        const response = await axios.post(hasuraGraphQlUrl, {
            operationName,
            query,
            variables
        }, { headers });

        return response;
    } catch (error) {
        console.error('Error fetching Hasura data:', error);
        throw error; // or handle it as per your application's error handling policy
    }
}

const abProjectID = (contract, projectId) => `${contract.toLowerCase()}-${projectId}`;

const getProjectInfo = async (contract, projectId) => {
    try {
        const response = await graphQlCall(getProjectInfoQuery, { projectId: abProjectID(contract, projectId)});

        const projectData = response.data.data.project;
        const preferredIPFSGateway = projectData.contract.preferredIPFSGateway;
        const cid = projectData.externalAssetDependencies[0].cid;
        const invocationCount = projectData.invocations;

        const manifestUrl = `${preferredIPFSGateway}/${cid}`;

        const manifestResponse = await axios.get(manifestUrl);

        return [invocationCount, manifestResponse.data];
    } catch (error) {
        console.error('Error fetching data:', error);
        throw error; // or handle it as per your application's error handling policy
    }
};

const getTokens = async (contract, projectId, lastTokenId) => {
    const response = await graphQlCall(getProjectTokensQuery, { projectId: abProjectID(contract, projectId), lastTokenId: lastTokenId });

    const tokens = response.data.data.project.tokens;

    if (tokens.length === 900) {
        // paginate
        const lastTokenId = tokens[899].id;
        const nextTokens = await getTokens(contract, projectId, lastTokenId);
        return [...tokens, ...nextTokens];
    }   else {
        return tokens;
    }
}

const getDotTokens = async (contract, projectId, tokens) => {
    const response = await graphQlCall(getDotsTokensQuery, { projectId: abProjectID(contract, projectId), dotTokenIds: tokens.map(token => token.toString()) });

    const dotTokens = response.data.data.project.tokens;

    return dotTokens
}

const refreshABTokens = async (tokenIds) => {
    const { jwt } = await getJwtGql(publicAddress);
    const response = await hasuraGraphQlCall(refreshABTokensQuery, { tokenIds, features: true, render: true, renderVideo: false }, jwt, 'UpdateTokenMedia');

    if(!response || !response.data.data.updateTokenMedia) {
      throw new Error("Failed to refresh AB tokens");
    }

    return response.data.data.updateTokenMedia;
}

const pinJSONToIPFS = async (pinataApiKey, pinataSecretApiKey, JSONBody) => {
    const url = `https://api.pinata.cloud/pinning/pinJSONToIPFS`;

    // make request to Pinata
    return axios
        .post(url, JSONBody, {
            headers: {
                pinata_api_key: pinataApiKey,
                pinata_secret_api_key: pinataSecretApiKey,
            }
        })
        .then(function (response) {
            // handle success
            return response.data.IpfsHash;
        })
        .catch(function (error) {
            // handle error
            console.error(error);
            return null;
        });
};

const getNewCompositeTokens = async () => {
    // Get composite manifest JSON by reading CID deps on composite project via the Graph 
    const [_invocationCount, compositeManifestJson] = await getProjectInfo(secondaryContract, secondaryProjectId);

    // Find out last composite invocation in manifest JSON
    const lastProcessedId = Math.max(...Object.keys(compositeManifestJson).map(key => Number(key))).toString();

    // Grab composite tokens > last processed invocation via Graph API
    const compositeTokens = await getTokens(secondaryContract, secondaryProjectId, lastProcessedId);

    return { compositeTokens, compositeManifestJson };
}

const composeAndPinNewManifest = async (compositeTokens, compositeManifestJson) => {
    let newCompostiteManifestJson = compositeManifestJson;

    // For each unprocessed token grab the dots tokenId, hash that were passed in from mint tx logs
    await Promise.all(compositeTokens.map(async (token) =>  {
        const dotsIdsForToken = await getRedeemedDotsFor(secondaryContract, token.tokenId);
        const dots = await getDotTokens(dotsContract, dotsProjectId, dotsIdsForToken);

        // Append this data for each composite to the JSON
        newCompostiteManifestJson[token.tokenId] = { dots }
    }))

    // Pin new composite minifest JSON file to IPFS via Pinata, get new CID
    const newCompositeManifestCid = await pinJSONToIPFS(pinataApiKey, pinataSecretApiKey, newCompostiteManifestJson);

    // tx to update CID for dependency on composite engine contract 
    const engineWithSigner = secondaryEngineContract.connect(wallet);
    const tx = await engineWithSigner.updateProjectExternalAssetDependency(secondaryProjectId, 0, newCompositeManifestCid, 0);
    const receipt = await tx.wait();

    console.log('Update CID Transaction receipt:', receipt.transactionHash);

    return receipt;
}

export const handler = async (event) => {

  const { compositeTokens, compositeManifestJson } = await getNewCompositeTokens();

  if (compositeTokens.length > 0) {
    const receipt = await composeAndPinNewManifest(compositeTokens, compositeManifestJson);

    if (receipt.status === 1) {
       console.log('New composite manifest CID updated successfully');

      // refresh AB
      const responseRefresh = await refreshABTokens(compositeTokens.map(token => token.id));
      console.log('AB Refresh done:', responseRefresh);
    } else {
      console.log('New composite manifest CID update failed');
    }
  } else {
    console.log('No new tokens to process');
  }
};