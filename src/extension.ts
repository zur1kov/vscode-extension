// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { execFile, ExecFileException } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';

const execFileAsync = promisify(execFile);

type Test = {
	name: string;
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

type CreateTestResult = {
	ok: true;
} | {
	ok: false;
	error: string
};

async function getTests(sourcePath: string, outExists: boolean = true): Promise<GetTestResult> {
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
			if (!outExists || fs.existsSync(outFile)) {
				tests.push({
					name: String(path.parse(files[i]).name),
					inputFile: inFile,
					outputFile: outFile
				});
			}
		}
	}
	return { ok: true, tests: tests };
}

async function runTest(binFilename: string, test: Test): Promise<string> {
	const p = execFileAsync(binFilename, { timeout: 3000 });
	try {
		const input = await fs.promises.readFile(test.inputFile, 'utf-8');
		const output = await fs.promises.readFile(test.outputFile, 'utf-8');
		p.child.stdin?.end(input);
		const { stdout } = await p;
		if (stdout != output) {
			return "WA";
		}
	} catch (e) {
		if ((e as ExecFileException).killed) {
			return "TL";
		}
		return "RE";
	}

	return "OK";
}

async function createTest(binFilename: string,
	test: Test): Promise<CreateTestResult> {
	const p = execFileAsync(binFilename, { timeout: 3000 });
	try {
		const input = await fs.promises.readFile(test.inputFile, 'utf-8');
		p.child.stdin?.end(input);
		const { stdout } = await p;
		await fs.promises.writeFile(test.outputFile, stdout, 'utf-8')
	} catch (e) {
		return {
			ok: false,
			error: (e as Error).message
		}
	}


	return { ok: true }
}

async function compile(sourcePath: string): Promise<CompileResult> {
	let binFilename = path.join(path.dirname(sourcePath), path.parse(sourcePath).name)
	let cppFilename = path.join(path.dirname(sourcePath), path.parse(sourcePath).name) + ".cpp";

	try {
		await execFileAsync("g++", [cppFilename, "-std=c++17", "-o", binFilename]);
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

async function runTests(output: vscode.OutputChannel) {
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
		const verdict = await runTest(compileResult.binary, test);
		if (verdict === "OK") successTests++;
		output.appendLine(`Test ${test.name}: [${verdict}]`)
	}

	output.appendLine(`${successTests}/${tests.length} tests passed.`);
	output.show();
}

async function createTests(output: vscode.OutputChannel) {
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
	const testsResult = await getTests(editor.document.fileName, false);
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

	for (let i = 0; i < tests.length; i++) {
		let res = await createTest(compileResult.binary, tests[i]);
		if (!res.ok) {
			output.appendLine(`Error: ${res.error}`);
			output.show();
			return;
		}
	}

	output.appendLine('Tests created succesfully');
	output.show();
}

export function activate(context: vscode.ExtensionContext) {
	console.log('CP test runner is active');
	const output = vscode.window.createOutputChannel("CP Test Runner");

	const run_tests_command = vscode.commands.registerCommand('cp-test-runner.runTests', async () => {
		await runTests(output);
	});
	const create_tests_command = vscode.commands.registerCommand('cp-test-runner.createTests', async () => {
		await createTests(output);
	});

	context.subscriptions.push(run_tests_command, create_tests_command, output);

}

// This method is called when your extension is deactivated
export function deactivate() { }
