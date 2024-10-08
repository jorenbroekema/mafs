import glob from "fast-glob"
import path from "path"
import fs from "fs-extra"
import prettier from "prettier"

const SKIP = [
  // Animations are flaky
  /animated/i,
  /bezier/i,

  // KaTeX doesn't run correctly in the Playwright frame
  /latex/i,
]

const mafsRoot = path.join(import.meta.dirname, "..")

const guideExamplesFolder = path.join(mafsRoot, "docs/components/guide-examples")

const testFile = path.join(mafsRoot, "e2e/generated-vrt.spec.tsx")

const examples = glob
  .sync(`${guideExamplesFolder}/**/*.tsx`, { absolute: true })
  .filter((filepath) => !SKIP.some((skip) => skip.test(filepath)))

let testFileContent = `
// THIS FILE IS GENERATED BY ./${path.relative(mafsRoot, import.meta.filename)}
/* eslint-disable @typescript-eslint/no-explicit-any */

import { expect, test } from "@playwright/experimental-ct-react"
import {Page} from "@playwright/test"
import { TestContextProvider } from "../src/context/TestContext"

`

function formatName(name: string) {
  return name
    .split("-")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join("")
}

for (const example of examples) {
  const importedAs = formatName(path.basename(example, ".tsx"))
  const importedFrom = path.relative(path.dirname(testFile), example.replace(/\.tsx$/, ""))

  testFileContent += `import ${importedAs} from "${importedFrom}"\n`
}

testFileContent += `
  async function visualTest(mount: any, page: Page, node: React.ReactElement) {
    const component = await mount(node)
    ;(await component.locator(".MafsView").count()) === 0
      ? await expect(component).toHaveClass("MafsView")
      : await expect(component.locator(".MafsView")).toHaveClass("MafsView")
    await expect(page).toHaveScreenshot()
  }
`

for (const example of examples) {
  const dirname = path.relative(path.join(guideExamplesFolder, ".."), path.dirname(example))
  const testTitle = `${dirname}/${formatName(path.basename(example, ".tsx"))}`

  testFileContent += `
    test("${testTitle}", async ({ mount, page }) =>
      await visualTest(
        mount,
        page,
        <TestContextProvider value={{ overrideHeight: 500 }}>
          <${formatName(path.basename(example, ".tsx"))} />
        </TestContextProvider>
      ))
  `
}

prettier.resolveConfig(import.meta.filename).then(async (config) => {
  const formattedTestFileContent = await prettier.format(testFileContent, {
    parser: "typescript",
    ...config,
  })

  fs.writeFileSync(testFile, formattedTestFileContent)
})
