export NVM_ENVIRONMENT="staging"

## The Nevermined API Key of the Agent
export NVM_API_KEY="e...."

## The Nevermined API Key of the user who will subscribe to the text2speech agent
## This key will be used in the `query.ts` script
export SUBSCRIBER_NVM_API_KEY="eyJhbGciOiJFUzI1NksifQ.eyJpc3MiOiIweDU4MzhCNTUxMmNGOWYxMkZFOWYyYmVjY0IyMGViNDcyMTFGOUIwYmMiLCJzdWIiOiIweDFCMDZDRkIyMkYwODMyZmI5MjU1NDE1MmRiYjVGOWM5NzU2ZTkzN2QiLCJqdGkiOiIweDlmMGRkNmZhODNkMDY3ZDRiYzFkNzEyN2Q3ZWE0M2EwYmUwNzc1NWJmNjMxMTVmYzJhODhmOTQwZmY4MjQ1NGQiLCJleHAiOjE3NTk4NzQwMDEsImlhdCI6MTcyODMxNjQwMn0.SqlcnMvdIjpZdBDs8FBsruYUIVpS75My-l5VfVwsFdU_3Xz5DuYt1frdF0QZq8isx9NOsNgRSeG8sBVtvAl-vRw"

## The DID of the plan that a subscriber needs to buy to use the text2speech agent
# See https://staging.nevermined.app/en/subscription/did:nv:0847b237d6e6d238850440f72e88b3a719542a8ba73ecfa03bda2050820dda35
export PLAN_DID="did:nv:0847b237d6e6d238850440f72e88b3a719542a8ba73ecfa03bda2050820dda35"

## The Text2Speech Agent DID
export AGENT_DID="did:nv:3b54498f1acd89a6d763d83a2719f9d02d051a210ecd2f3bf78ef09997819701"

## The OpenAI Key used by the Agent. 
## This is necessary by the Text2Speech agent to generate the audio file
export OPEN_API_KEY="sk-"

## The IPFS configuration to upload generated audio files after their generation
export IPFS_GATEWAY="https://ipfs.infura.io:5001"
export IPFS_PROJECT_ID="...."
export IPFS_PROJECT_SECRET="....."