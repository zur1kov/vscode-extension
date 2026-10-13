// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

type Test = {
	id: number;
	inputFile: string;
	outputFile: string;
}

function getTests(): Test[] {
	return [];
}

function runTest(test: Test): string {
	if (!test) return "WA";

	return "OK";
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	console.log('CP test runner is active');
	const output = vscode.window.createOutputChannel("CP Test Runner");

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('cp-test-runner.runTests', () => {
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

		const tests = getTests();
		if (!tests.length) {
			output.appendLine("No tests provided");
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
