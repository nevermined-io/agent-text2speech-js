[![banner](https://raw.githubusercontent.com/nevermined-io/assets/main/images/logo/banner_logo.png)](https://nevermined.io)

# Text to Speech AI Agent (Typescript)

> Build AI Agents able to interact with other Agents and the Nevermined Network.

---

## Table of Contents

- [Text to Speech AI Agent (Typescript)](#text-to-speech-ai-agent-typescript)
  - [Table of Contents](#table-of-contents)
  - [Info](#info)
  - [How to run the basic text2speech demo](#how-to-run-the-basic-text2speech-demo)
  - [How to run the multi-agent demo](#how-to-run-the-multi-agent-demo)
  - [How to configure the agents](#how-to-configure-the-agents)
  - [License](#license)

---

## Info

This repository contains a software that leverages Nevermined AI Protocol to deliver an AI Agent that converts text to speech. 
The agent is built using Typescript and is based on the [Nevermined AI Query Protocol](https://docs.nevermined.io/docs/protocol/query-protocol) and connects to the [Nevermined AI Hub](https://docs.nevermined.app/docs/environments/ai-hub). This has the following characteristics:

* **Text to Speech**: The agent receives a text and returns an audio file with the speech of the text.
* **Nevermined integration**: The agent integrates the Nevermined Payments library and connects to the Nevermined AI Hub, so the agent itself doesn't expose an HTTP interface. It delegates that piece to Nevermined infrastructure. 
* **Minimal and simple code**: The agent is built using Typescript and has a minimal codebase. The main logic is in the `main.ts` file. 
* **Show Multi-Agent Interaction**: In the `agent2agent.ts` shows how to build an agent which interacts with other agents. In this case, it interacts with the `Youtube Summarizer Agent` to convert a Youtube URL to text that is later converted to speech.

## How to run the basic text2speech demo

This demo shows how to run a simple agent which converts text to speech. Just clone this repository and run the following commands:

```bash
# Load the environment variables
# Replace first using your own values
$ source .env.example.sh

# Install all the dependencies
$ yarn

# Runs the text2speech agent
$ yarn start:main

# Query the agent using the following command
# It will send the text to the agent and return the audio file
$ yarn start:query "hey there, how are you today?"

```

## How to run the multi-agent demo

This demo shows how to run an agent which interacts with other agents. In this case, it interacts with the `Youtube Summarizer Agent` to convert a Youtube URL to text that is later converted to speech. During that process the Text2Speech agent buys credits from the Youtube Summarizer agent and uses them to summarize the video. Just clone this repository and run the following commands:

```bash
# Load the environment variables
# Replace first using your own values
$ source .env.example.sh

# Install all the dependencies
$ yarn

# Runs the text2speech agent
$ yarn start:agent2agent

# Query the agent using the following command
# It will send the youtube video and return the audio with the summary of that video
$ yarn start:query https://www.youtube.com/watch?v=yubzJw0uiE4

```

## How to configure the agents

The agent can be configured using environment variables. The following variables are available:

- `NVM_ENVIRONMENT`: The Nevermined environment where the agent is registered. Default is `testing`. You can find the full list here: https://docs.nevermined.app/docs/libraries/getting-started#initialize-the-payments-instance
- `NVM_API_KEY`: The API key of the agent. This is used to authenticate the agent in the Nevermined network. To get yours check the following link: https://docs.nevermined.app/docs/tutorials/integration/nvm-api-keys
- `SUBSCRIBER_NVM_API_KEY`: The API key of the subscriber used in the `query.ts` script. This is used to authenticate the subscriber in the Nevermined network.
- `PLAN_DID`: The DID of the Text2Speech plan.
- `AGENT_DID`: The DID of the Text2Speech agent.
- `OPEN_API_KEY`: The OpenAI Key used by the Agent. This is necessary by the Text2Speech agent to generate the audio file

## License

```text
Copyright 2024 Nevermined AG

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```
