import fs, { mkdtempSync } from "fs"
import { join } from "path"
import OpenAI from "openai"

export class OpenAITools {
  private openai: OpenAI

  constructor(apiKey: string) {
    this.openai = new OpenAI({apiKey})
  }

  async text2speech(inputText: string, speechFile?: string) {
    const mp3 = await this.openai.audio.speech.create({
      model: "tts-1",
      voice: "alloy",
      input: inputText,
    })
    if (!speechFile) {
      const tmpDir = mkdtempSync('/tmp/text2speech-temp-')
      speechFile = join(tmpDir, 'text2speech.mp3')      
    }
    console.log(speechFile)
    const buffer = Buffer.from(await mp3.arrayBuffer())
    await fs.promises.writeFile(speechFile, buffer)
    return speechFile
  }
}