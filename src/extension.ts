// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';

const execFileAsync = promisify(execFile);

type Test = {
	inputFile: string;
	outputFile: string;
}
type CompileResult = {
	ok: true;
	binary: string
} | {
	ok: false;
	error: string
};

type GetTestResult = {
	ok: true;
	tests: Test[];
} | {
	ok: false;
	error: string
};

async function getTests(sourcePath: string): Promise<GetTestResult> {
	let testsPath = path.join(path.dirname(sourcePath), "tests");
	if (!fs.existsSync(testsPath)) {
		return { ok: false, error: "tests folder doesn't exist" }
	}
	let files = await fs.promises.readdir(testsPath);
	let tests: Test[] = [];
	files.sort();
	for (let i = 0; i < files.length; i++) {
		if (files[i].endsWith('.in')) {
			let inFile = path.join(testsPath, files[i]);
			let outFile = path.join(testsPath, String(path.parse(files[i]).name) + ".out");
			if (fs.existsSync(outFile)) {
				tests.push({
					inputFile: inFile,
					outputFile: outFile
				});
			}
		}
	}
	return { ok: true, tests: tests };
}

function runTest(test: Test): string {
	if (!test) return "WA";

	return "OK";
}

async function compile(sourcePath: string): Promise<CompileResult> {
	let binFilename = path.join(path.dirname(sourcePath), path.parse(sourcePath).name)
	let cppFilename = path.join(path.dirname(sourcePath), path.parse(sourcePath).name) + ".cpp";

	try {
		await execFileAsync("g++", [cppFilename, "-O2", "-std=c++17", "-o", binFilename]);
		return {
			"ok": true,
			"binary": binFilename
		}
	} catch (e) {
		return {
			"ok": false,
			"error": (e as Error).message
		}
	}

}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	console.log('CP test runner is active');
	const output = vscode.window.createOutputChannel("CP Test Runner");

	const disposable = vscode.commands.registerCommand('cp-test-runner.runTests', async () => {
		const editor = vscode.window.activeTextEditor;
		output.appendLine('Running tests...');

		if (undefined == editor) {
			vscode.window.showErrorMessage("No active editor for tests");
			return;
		}
		output.appendLine(`Proccessing file ${editor.document.fileName}`);
		if (editor.document.languageId !== "cpp") {
			vscode.window.showErrorMessage("Provided file is not C++ file");
			return;
		}

		let compileResult = await compile(editor.document.fileName);
		if (!compileResult.ok) {
			vscode.window.showErrorMessage("Error: " + String(compileResult.error));
			output.appendLine("Error: " + String(compileResult.error));
			output.show();
			return;
		} else {
			output.appendLine("Compiled successfully");
			output.show();
		}
		const testsResult = await getTests(editor.document.fileName);
		if (!testsResult.ok) {
			vscode.window.showErrorMessage("Error: " + String(testsResult.error));
			output.appendLine("Error: " + String(testsResult.error));
			output.show();
			return;
		}
		const tests = testsResult.tests;
		if (!tests.length) {
			output.appendLine("No tests provided");
			output.show();
			vscode.window.showErrorMessage("No tests provided");
			return;
		}

		let successTests = 0;
		for (let i = 0; i < tests.length; i++) {
			const test = tests[i];
			const verdict = runTest(test);
			if (verdict !== "OK") {
				output.appendLine(`Error ${verdict} in test ${i + 1}`);
				output.show();
			} else {
				output.appendLine(`Test ${i + 1} passed succesfully`);
				output.show();
				successTests++;
			}
		}

		output.appendLine(`${successTests}/${tests.length} tests passed.`);
		output.show();

	});

	context.subscriptions.push(disposable, output);
}

// This method is called when your extension is deactivated
export function deactivate() { }
