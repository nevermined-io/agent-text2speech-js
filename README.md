[![banner](https://raw.githubusercontent.com/nevermined-io/assets/main/images/logo/banner_logo.png)](https://nevermined.io)

# Text to Speech AI Agent (Typescript)

> Build AI Agents able to interact with other Agents and the Nevermined Network.

---

## Table of Contents

- [Text to Speech AI Agent (Typescript)](#text-to-speech-ai-agent-typescript)
  - [Table of Contents](#table-of-contents)
  - [Info](#info)
  - [How to run it](#how-to-run-it)
  - [How to configure the agent](#how-to-configure-the-agent)
  - [License](#license)

---

## Info

This repository contains a software that leverages Nevermined AI Protocol to deliver an AI Agent that converts text to speech. 
The agent is built using Typescript and is based on the [Nevermined AI Query Protocol](https://docs.nevermined.io/docs/protocol/query-protocol) and connects to the [Nevermined AI Hub](https://docs.nevermined.app/docs/environments/ai-hub). This has the following characteristics:

* **Text to Speech**: The agent receives a text and returns an audio file with the speech of the text.
* **Nevermined integration**: The agent integrates the Nevermined Payments library and connects to the Nevermined AI Hub, so the agent itself doesn't expose an HTTP interface. It delegates that piece to Nevermined infrastructure. 
* **Minimal and simple code**: The agent is built using Typescript and has a minimal codebase. The main logic is in the `main.ts` file.


## How to run it

Just clone this repository and run the following commands:

```bash
# Install all the dependencies
$ yarn

# Start the backend transactions processor
$ yarn start
```


## How to configure the agent

The agent can be configured using environment variables. The following variables are available:

- `NVM_ENVIRONMENT`: The Nevermined environment where the agent is registered. Default is `testing`. You can find the full list here: https://docs.nevermined.app/docs/libraries/getting-started#initialize-the-payments-instance
- `NVM_AGENT_DID`: The DID of the agent. This is used to identify the agent in the Nevermined network. Example: `did:nv:123456789abcdefghi`.
- `NVM_SUBSCRIPTION_DID`: The DID of the subscription. This is used to identify the subscription in the Nevermined network. Example: `did:nv:123456789abcdefghi`.


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
