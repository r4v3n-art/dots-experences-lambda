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

  static getProjectInfoQuery = `query GetCompositeDeps($contractAddress: String!, $projectId: String!) {
    projects_metadata(where: {contract_address: {_eq: $contractAddress}, project_id: {_eq: $projectId}}) {
      id
      invocations
      project_id
      name
      contract_address
      external_asset_dependencies {
        cid
      }
    }
  }`;

  static getProjectTokensQuery = `query GetCompositeTokens($contractAddress: String!, $projectId: String!, $lastTokenId: Int!) {
    tokens_metadata(where: {contract_address: {_eq: $contractAddress}, project_id: {_eq: $projectId}, invocation: {_gt: $lastTokenId}}, limit: 900, order_by: {invocation: asc}) {
        id
        token_id
        invocation
    }
  }`;

  static getDotsTokensQuery = `
  query GetDotsTokens($contractAddress: String!, $projectId: String!, $dotTokenIds: [String!]) {
    tokens_metadata(where: {contract_address: {_eq: $contractAddress}, project_id: {_eq: $projectId}, token_id: {_in: $dotTokenIds}}, limit: 900) {
        hash
        token_id
    }
  }`;

  static getAllTokensQuery = `
  query GetAllTokens($contractAddress: String!, $projectId: String!) {
    tokens_metadata(where: {contract_address: {_eq: $contractAddress}, project_id: {_eq: $projectId}}, limit: 1000, order_by: {invocation: asc}) {
        id
        token_id
        invocation
    }
  }`;

  static updateProjectMediaQuery = `
    mutation UpdateProjectMedia($projectId: String!, $features: Boolean!, $render: Boolean!, $renderVideo: Boolean!) {
        updateProjectMedia(
          projectId: $projectId
          features: $features    
          render: $render
          renderVideo: $renderVideo
        ) {
          __typename
        }
    }
  `;

  static updateTokenMediaQuery = `
    mutation UpdateProjectMedia($projectId: String!, $features: Boolean!, $render: Boolean!, $renderVideo: Boolean!) {
        updateProjectMedia(
          projectId: $projectId
          features: $features    
          render: $render
          renderVideo: $renderVideo
        ) {
          __typename
        }
    }
  `;



  fetchMessageFromApiGql = async (userAddress) => {
    try {
      console.log(`Fetching auth message for address: ${userAddress}`);
      
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
      console.log('Auth message response:', JSON.stringify(result.data, null, 2));

      if (!result || !result.data.data.getAuthMessage) {
        throw new Error("Failed to fetch auth message");
      }

      return result.data.data.getAuthMessage.authMessage;
    } catch (error) {
      console.error("Error fetching auth message:", error);
      throw error;
    }
  };

  getJwtGql = async (userAddress) => {
    try {
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
    } catch (error) {
      console.error("Error in JWT authentication:", error);
      throw error;
    }
  };

  getRedeemedDotsFor = async (engineAddress, tokenId) => {
    try {
      console.log(`Getting redeemed dots for token ${tokenId} from engine ${engineAddress}`);
      
      // Call the `redeemedDotsFor` function
      const redeemedDots = await this.dotsMinter.redeemedDotsFor(
        engineAddress,
        tokenId
      );

      console.log(`Redeemed dots for token ${tokenId}:`, redeemedDots);

      if (!redeemedDots || redeemedDots.length === 0) {
        console.log(`No redeemed dots found for token ${tokenId}`);
        return [];
      }

      return redeemedDots;
    } catch (error) {
      console.error("Error getting redeemed dots for token", tokenId, ":", error);
      return [];
    }
  };

  graphQlCall = async (query, variables) => {
    try {
      console.log(`Making GraphQL request to: ${graphQlUrl}`);
      console.log(`Query: ${query}`);
      console.log(`Variables:`, JSON.stringify(variables, null, 2));
      
      const response = await axios.post(graphQlUrl, {
        query,
        variables,
      });

      console.log(`GraphQL response status: ${response.status}`);
      return response;
    } catch (error) {
      console.error("Error fetching Graph data:", error);
      if (error.response) {
        console.error("Response status:", error.response.status);
        console.error("Response data:", JSON.stringify(error.response.data, null, 2));
      }
      throw error;
    }
  };

  hasuraGraphQlCall = async (query, variables, jwt = null, operationName = null, customHeaders = null) => {
    const headers = jwt
      ? {
          Authorization: `Bearer ${jwt}`,
          "Content-Type": "application/json",
          "x-hasura-role": "allowlisted",
          ...customHeaders
        }
      : {
          "Content-Type": "application/json",
          ...customHeaders
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

  getProjectInfo = async (contract, projectId) => {
    try {
      console.log(`Fetching project info for contract: ${contract}, projectId: ${projectId}`);
      
      const response = await this.hasuraGraphQlCall(Job.getProjectInfoQuery, {
        contractAddress: contract.toLowerCase(),
        projectId: projectId.toString(),
      });

      console.log('Hasura GraphQL Response:', JSON.stringify(response.data, null, 2));

      if (!response.data || !response.data.data) {
        throw new Error(`Invalid response structure: ${JSON.stringify(response.data)}`);
      }

      if (!response.data.data.projects_metadata || response.data.data.projects_metadata.length === 0) {
        throw new Error(`Project not found for contract: ${contract}, projectId: ${projectId}. Response: ${JSON.stringify(response.data)}`);
      }

      const projectData = response.data.data.projects_metadata[0];
      const preferredIPFSGateway = 'https://gateway.pinata.cloud/ipfs/';
      const cid = projectData.external_asset_dependencies[0]?.cid;
      const invocationCount = projectData.invocations;

      if (!cid) {
        throw new Error(`No external asset dependency found for project: ${projectId}`);
      }

      const manifestUrl = `${preferredIPFSGateway}${cid}`;
      console.log(`Fetching manifest from: ${manifestUrl}`);

      const manifestResponse = await axios.get(manifestUrl);

      return [invocationCount, manifestResponse.data];
    } catch (error) {
      console.error("Error fetching data:", error);
      throw error;
    }
  };

  getTokens = async (contract, projectId, lastTokenId) => {
    console.log(`Querying for tokens with invocation > ${lastTokenId} for contract: ${contract}, projectId: ${projectId}`);
    
    const response = await this.hasuraGraphQlCall(Job.getProjectTokensQuery, {
      contractAddress: contract.toLowerCase(),
      projectId: projectId.toString(),
      lastTokenId: parseInt(lastTokenId),
    });

    console.log('Tokens query response:', JSON.stringify(response.data, null, 2));

    const tokens = response.data.data.tokens_metadata;

    if (tokens.length === 900) {
      // paginate
      const lastTokenId = tokens[899].invocation;
      return [...tokens, ...await this.getTokens(contract, projectId, lastTokenId)];
    } else {
      return tokens;
    }
  };

  getDotTokens = async (contract, projectId, tokens) => {
    try {
      console.log(`Getting dot tokens for contract: ${contract}, projectId: ${projectId}, tokenIds: ${tokens.join(', ')}`);
      
      // Since dots are in a separate contract, we'll create a simple structure
      // with the token IDs and their hashes (if available)
      const dotTokens = tokens.map(tokenId => ({
        token_id: tokenId,
        hash: `0x${tokenId.toString().padStart(64, '0')}`, // Placeholder hash
        id: `${contract.toLowerCase()}-${tokenId}`
      }));

      console.log(`Created ${dotTokens.length} dot token entries`);
      return dotTokens;
    } catch (error) {
      console.error("Error getting dot tokens:", error);
      return [];
    }
  };

  getAllTokens = async (contract, projectId) => {
    const response = await this.hasuraGraphQlCall(Job.getAllTokensQuery, {
      contractAddress: contract.toLowerCase(),
      projectId: projectId.toString(),
    });

    return response.data.data.tokens_metadata;
  };

    updateProjectMedia = async (projectId) => {
    try {
      console.log(`Updating project media for project ${projectId}...`);
      
      const { jwt } = await this.getJwtGql(publicAddress);
      console.log(`Got JWT, attempting project media update...`);
      
      // Add the required x-hasura-role header for the action
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`,
        'x-hasura-role': 'artist'  // Use artist role since we're the project artist
      };
      
      const response = await this.hasuraGraphQlCall(
        Job.updateProjectMediaQuery,
        { 
          projectId: projectId.toString(), 
          features: true, 
          render: true, 
          renderVideo: false 
        },
        jwt,
        "UpdateProjectMedia",
        headers
      );

      console.log('Project media update response:', JSON.stringify(response.data, null, 2));

      if (!response || !response.data.data.updateProjectMedia) {
        console.error('Project media update failed - no updateProjectMedia in response');
        if (response.data.errors) {
          console.error('GraphQL errors:', response.data.errors);
        }
        throw new Error("Failed to update project media");
      }

      return response.data.data.updateProjectMedia;
    } catch (error) {
      console.error("Error in updateProjectMedia:", error);
      throw error;
    }
  };

    updateTokenMedia = async (tokenId) => {
    try {
      console.log(`Updating project media for token ${tokenId}...`);
      
      const { jwt } = await this.getJwtGql(publicAddress);
      console.log(`Got JWT, attempting project media update...`);
      
      // Add the required x-hasura-role header for the action
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`,
        'x-hasura-role': 'artist'  // Use artist role since we're the project artist
      };
      
      // Extract project ID from token ID (format: contract-tokenId)
      const projectId = secondaryProjectId;
      
      const response = await this.hasuraGraphQlCall(
        Job.updateTokenMediaQuery,
        { 
          projectId: projectId.toString(), 
          features: true, 
          render: true, 
          renderVideo: false 
        },
        jwt,
        "UpdateProjectMedia",
        headers
      );

      console.log('Project media update response:', JSON.stringify(response.data, null, 2));

      if (!response || !response.data.data.updateProjectMedia) {
        console.error('Project media update failed - no updateProjectMedia in response');
        if (response.data.errors) {
          console.error('GraphQL errors:', response.data.errors);
        }
        throw new Error("Failed to update project media");
      }

      return response.data.data.updateProjectMedia;
    } catch (error) {
      console.error("Error in updateTokenMedia:", error);
      throw error;
    }
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
    const [invocationCount, compositeManifestJson] = await this.getProjectInfo(
      secondaryContract,
      secondaryProjectId
    );

    console.log(`Project has ${invocationCount} total invocations`);
    console.log(`Current manifest has ${Object.keys(compositeManifestJson).length} tokens`);

    // Find missing token IDs
    const existingTokenIds = Object.keys(compositeManifestJson).map(Number);
    const allTokenIds = Array.from({length: invocationCount}, (_, i) => i);
    const missingTokenIds = allTokenIds.filter(id => !existingTokenIds.includes(id));
    


    console.log(`Missing token IDs: ${missingTokenIds.join(', ')}`);




    // Create composite tokens array for missing tokens
    const compositeTokens = missingTokenIds.map(tokenId => ({
      id: `${secondaryContract.toLowerCase()}-${tokenId}`,
      token_id: tokenId,
      invocation: tokenId
    }));

    return { compositeTokens, compositeManifestJson };
  };

  buildManifest = async (compositeTokens, compositeManifestJson) => {
    let newJson = compositeManifestJson;

    for (const token of compositeTokens) {
      console.log(`Processing token ${token.token_id}...`);
      
      const dotsIdsForToken = await this.getRedeemedDotsFor(
        secondaryContract,
        token.token_id
      );

      if (dotsIdsForToken.length === 0) {
        console.log(`Skipping token ${token.token_id} - no redeemed dots`);
        continue;
      }

      console.log(`Token ${token.token_id} has ${dotsIdsForToken.length} redeemed dots:`, dotsIdsForToken.map(d => d.toString()));

      const dots = await this.getDotTokens(
        dotsContract,
        dotsProjectId,
        dotsIdsForToken.map((dot) => dot.toString())
      );

      console.log(`Created ${dots.length} dot entries for token ${token.token_id}`);
      newJson[token.token_id] = { dots };
    }

    return newJson;
  };

  composeAndPinNewManifest = async (compositeTokens, compositeManifestJson) => {
    const oldJson = { ...compositeManifestJson };
    const newJson = await this.buildManifest(compositeTokens, compositeManifestJson);
    
    // Deep comparison to check if anything actually changed
    const hasChanges = JSON.stringify(newJson) !== JSON.stringify(oldJson);
    
    if (!hasChanges) {
      console.log('No changes detected in manifest data - skipping update');
      return { receipt: null, newCompositeManifestCid: null, hasChanges: false };
    }

    console.log('Changes detected in manifest data - updating Pinata and contract');

    const newCompositeManifestCid = await this.pinJSONToIPFS(newJson);
    console.log('New manifest CID:', newCompositeManifestCid);

    const engineWithSigner = this.secondaryEngineContract.connect(this.wallet);
    const tx = await engineWithSigner.updateProjectExternalAssetDependency(
      secondaryProjectId,
      0,
      newCompositeManifestCid,
      0
    );
    const receipt = await tx.wait();

    return { receipt, newCompositeManifestCid, hasChanges: true };
  };

  run = async () => {
    // First, let's check what tokens actually exist in the database
    console.log('Checking all tokens in the project...');
    const allTokens = await this.getAllTokens(secondaryContract, secondaryProjectId);
    console.log(`Total tokens in database: ${allTokens.length}`);
    console.log('Token invocations:', allTokens.map(t => t.invocation).sort((a, b) => a - b));
    
    const { compositeTokens, compositeManifestJson } = await this.getNewCompositeTokens();

    if (compositeTokens.length > 0) {
      const { receipt, newCompositeManifestCid, hasChanges } = await this.composeAndPinNewManifest(compositeTokens, compositeManifestJson);

                            if (hasChanges) {
                        if (receipt && receipt.status === 1) {
                          console.log('New composite manifest CID updated successfully');
                          console.log('Art Blocks project dependency updated via smart contract');
                          
                          try {
                            console.log('Triggering AB project media update for re-rendering...');
                            
                            // Update project media to refresh all tokens in the project
                            const responseUpdate = await this.updateProjectMedia(secondaryProjectId);
                            console.log('AB project media update completed:', responseUpdate);
                          } catch (error) {
                            console.error('AB project media update failed:', error.message);
                            console.log('Continuing without project media update...');
                          }
                        } else {
                          console.log('New composite manifest CID update failed');
                        }
                      } else {
                        console.log('No changes detected - no updates needed');
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

export { Job };
