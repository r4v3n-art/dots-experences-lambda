import axios from "axios";
import { ethers } from "ethers";
import dotsMinterAbi from "./dotsMinterAbi.js";
import engineContractAbi from "./engineContractAbi.js";
import { config } from "dotenv";

// Load environment variables
config();
const alchemyApiKey = process.env.ALCHEMY_KEY;
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
const publicAddress = process.env.PUBLIC_ADDRESS;
const rpcProviderUrl = process.env.RPC_PROVIDER_URL;

class Job {
  constructor() {
    this.provider = new ethers.providers.StaticJsonRpcProvider(
      `${rpcProviderUrl}/${alchemyApiKey}`
    );

    // Create a wallet instance from a private key
    this.wallet = new ethers.Wallet(privateKey, this.provider);

    // Create a contract instance
    this.dotsMinter = new ethers.Contract(
      dotsMinterContract,
      JSON.parse(dotsMinterAbi),
      this.provider
    );

    this.secondaryEngineContract = new ethers.Contract(
      secondaryContract,
      JSON.parse(engineContractAbi),
      this.provider
    );
  }

  static getProjectInfoQuery = `query GetCompositeDeps($projectId: String) {
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

  static getProjectTokensQuery = `query GetCompositeTokens($projectId: String, $lastTokenId: String) {
    project(
          id: $projectId
    ) {
        tokens(where: {invocation_gt: $lastTokenId}, first: 900) {
            id
            tokenId
        }
    }
  }`;

  static getDotsTokensQuery = `
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

  static refreshABTokensQuery = `
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
  `;

  fetchMessageFromApiGql = async (userAddress) => {
    const query = `
      query GetAuthMessage($publicAddress: String!, $domain: String!, $uri: String!) {
        getAuthMessage(publicAddress: $publicAddress, domain: $domain, uri: $uri) {
          authMessage
        }
      }
    `;

    const variables = {
      publicAddress: userAddress,
      domain: "r4v3n.art",
      uri: "https://r4v3n.art/builder",
    };

    const result = await this.hasuraGraphQlCall(query, variables);

    if (!result || !result.data.data.getAuthMessage) {
      throw new Error("Failed to fetch auth message");
    }

    return result.data.data.getAuthMessage.authMessage;
  };

  getJwtGql = async (userAddress) => {
    const address = ethers.utils.getAddress(userAddress);
    const message = await this.fetchMessageFromApiGql(address);

    let signature = await this.wallet.signMessage(message);

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
        signature,
      },
    };

    const result = await this.hasuraGraphQlCall(mutation, variables);

    if (!result || !result.data.data.authenticate) {
      throw new Error("Failed to fetch AB JWT");
    }

    return {
      jwt: result.data.data.authenticate.jwt,
      expiration: result.data.data.authenticate.expiration,
    };
  };

  getRedeemedDotsFor = async (engineAddress, tokenId) => {
    try {
      // Call the `redeemedDotsFor` function
      const redeemedDots = await this.dotsMinter.redeemedDotsFor(
        engineAddress,
        tokenId
      );

      if (!redeemedDots || redeemedDots.length === 0) {
        throw new Error("Failed to fetch dots for token: " + tokenId);
      }

      return redeemedDots;
    } catch (error) {
      console.error("Error:", error);
    }
  };

  graphQlCall = async (query, variables) => {
    try {
      const response = await axios.post(graphQlUrl, {
        query,
        variables,
      });

      return response;
    } catch (error) {
      console.error("Error fetching Graph data:", error);
      throw error;
    }
  };

  hasuraGraphQlCall = async (query, variables, jwt = null, operationName = null) => {
    const headers = jwt
      ? {
          Authorization: `Bearer ${jwt}`,
          "Content-Type": "application/json",
          "x-hasura-role": "allowlisted",
        }
      : {
          "Content-Type": "application/json",
        };

    try {
      const response = await axios.post(
        hasuraGraphQlUrl,
        {
          operationName,
          query,
          variables,
        },
        { headers }
      );

      return response;
    } catch (error) {
      console.error("Error fetching Hasura data:", error);
      throw error;
    }
  };

  abProjectID = (contract, projectId) =>
    `${contract.toLowerCase()}-${projectId}`;

  getProjectInfo = async (contract, projectId) => {
    try {
      const response = await this.graphQlCall(Job.getProjectInfoQuery, {
        projectId: this.abProjectID(contract, projectId),
      });

      const projectData = response.data.data.project;
      const preferredIPFSGateway = projectData.contract.preferredIPFSGateway;
      const cid = projectData.externalAssetDependencies[0].cid;
      const invocationCount = projectData.invocations;

      const manifestUrl = `${preferredIPFSGateway}/${cid}`;

      const manifestResponse = await axios.get(manifestUrl);

      return [invocationCount, manifestResponse.data];
    } catch (error) {
      console.error("Error fetching data:", error);
      throw error;
    }
  };

  getTokens = async (contract, projectId, lastTokenId) => {
    const response = await this.graphQlCall(Job.getProjectTokensQuery, {
      projectId: this.abProjectID(contract, projectId),
      lastTokenId: lastTokenId,
    });

    const tokens = response.data.data.project.tokens;

    if (tokens.length === 900) {
      // paginate
      const lastTokenId = tokens[899].id;
      return [...tokens, ...await this.getTokens(contract, projectId, lastTokenId)];
    } else {
      return tokens;
    }
  };

  getDotTokens = async (contract, projectId, tokens) => {
    const response = await this.graphQlCall(Job.getDotsTokensQuery, {
      projectId: this.abProjectID(contract, projectId),
      dotTokenIds: tokens.map((token) => token.toString()),
    });

    const dotTokens = response.data.data.project.tokens;

    return dotTokens;
  };

  refreshABTokens = async (tokenIds) => {
    const { jwt } = await this.getJwtGql(publicAddress)
    const response = await this.hasuraGraphQlCall(
      Job.refreshABTokensQuery,
      { tokenIds, features: true, render: true, renderVideo: false },
      jwt,
      "UpdateTokenMedia"
    );

    if (!response || !response.data.data.updateTokenMedia) {
      throw new Error("Failed to refresh AB tokens", response.data.errors);
    }

    return response.data.data.updateTokenMedia;
  };

  pinJSONToIPFS = async (JSONBody) => {
    const url = `https://api.pinata.cloud/pinning/pinJSONToIPFS`;

    try {
      const response = await axios.post(url, JSONBody, {
        headers: {
          pinata_api_key: pinataApiKey,
          pinata_secret_api_key: pinataSecretApiKey,
        },
      });

      return response.data.IpfsHash;
    } catch (error) {
      console.error("Error pinning to IPFS:", error);
      throw error;
    }
  };

  getNewCompositeTokens = async () => {
    const [_invocationCount, compositeManifestJson] = await this.getProjectInfo(
      secondaryContract,
      secondaryProjectId
    );

    let lastProcessedId = "-1";
    if (Object.keys(compositeManifestJson).length > 0) {
      lastProcessedId = Math.max(...Object.keys(compositeManifestJson).map(Number)).toString();
    }

    const compositeTokens = await this.getTokens(
      secondaryContract,
      secondaryProjectId,
      lastProcessedId
    );

    return { compositeTokens, compositeManifestJson };
  };

  buildManifest = async (compositeTokens, compositeManifestJson) => {
    let newJson = compositeManifestJson;

    for (const token of compositeTokens) {
      const dotsIdsForToken = await this.getRedeemedDotsFor(
        secondaryContract,
        token.tokenId
      );

      const dots = await this.getDotTokens(
        dotsContract,
        dotsProjectId,
        dotsIdsForToken.map((dot) => dot.toString())
      );

      newJson[token.tokenId] = { dots };
    }

    return newJson;
  };

  composeAndPinNewManifest = async (compositeTokens, compositeManifestJson) => {
    const oldJson = { ...compositeManifestJson };
    const newJson = await this.buildManifest(compositeTokens, compositeManifestJson);
    if (newJson === oldJson) {
      throw new Error("Did not correctly set up new composite manifest JSON file");
    }

    const newCompositeManifestCid = await this.pinJSONToIPFS(newJson);

    const engineWithSigner = this.secondaryEngineContract.connect(this.wallet);
    const tx = await engineWithSigner.updateProjectExternalAssetDependency(
      secondaryProjectId,
      0,
      newCompositeManifestCid,
      0
    );
    const receipt = await tx.wait();

    return receipt;
  };

  run = async () => {
    const { compositeTokens, compositeManifestJson } = await this.getNewCompositeTokens();

    if (compositeTokens.length > 0) {
      const receipt = await this.composeAndPinNewManifest(compositeTokens, compositeManifestJson);

      if (receipt.status === 1) {
        console.log('New composite manifest CID updated successfully');

        const responseRefresh = await this.refreshABTokens(compositeTokens.map(token => token.id));
        console.log('AB Refresh done:', responseRefresh);
      } else {
        console.log('New composite manifest CID update failed');
      }
    } else {
      console.log('No new tokens to process');
    }
  };
}

export const handler = async (event) => {
  try {
    const job = new Job();
    await job.run();

    return { success: true, message: 'Dots IPFS refresh task completed' };
  } catch (error) {
    console.error('Error executing scheduled Dots IPFS Refresh', error);
    throw new Error('Failed to complete Dots IPFS refresh task');
  }
};