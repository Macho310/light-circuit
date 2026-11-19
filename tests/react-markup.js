import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Compile local TSX to an in-memory module for server-rendered component tests.
export function componentURL(sourceURL) {
  let code = ts.transpileModule(readFileSync(sourceURL, 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  code = code.replace(/from (['"])(.*?)\1/g, (_, quote, specifier) => {
    if (!specifier.startsWith('.')) return `from ${JSON.stringify(import.meta.resolve(specifier))}`;
    const target = new URL(specifier, sourceURL);
    return `from ${JSON.stringify(/\.[cm]?js$/.test(specifier) ? target.href : componentURL(new URL(`${specifier}.tsx`, sourceURL)))}`;
  });
  return `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
}
