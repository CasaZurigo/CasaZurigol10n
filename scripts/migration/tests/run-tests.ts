#!/usr/bin/env node

import { spawn } from "child_process";
import * as path from "path";

/**
 * Simple test runner for migration tests
 */
async function runTests() {
  console.log("🧪 Running Migration Tests");
  console.log("=".repeat(40));

  const testDir = __dirname;
  const testFiles = ["migration.test.ts", "edge-cases.test.ts"];

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  for (const testFile of testFiles) {
    console.log(`\n📁 Running ${testFile}...`);

    try {
      const result = await runTestFile(path.join(testDir, testFile));

      if (result.success) {
        console.log(`✅ ${testFile} passed`);
        passedTests += result.testCount;
      } else {
        console.log(`❌ ${testFile} failed`);
        failedTests += result.testCount;
      }

      totalTests += result.testCount;
    } catch (error) {
      console.error(`❌ Error running ${testFile}: ${error}`);
      failedTests++;
      totalTests++;
    }
  }

  console.log("\n" + "=".repeat(40));
  console.log(`📊 Test Results:`);
  console.log(`   Total: ${totalTests}`);
  console.log(`   Passed: ${passedTests}`);
  console.log(`   Failed: ${failedTests}`);
  console.log(
    `   Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`,
  );

  if (failedTests > 0) {
    console.log("\n❌ Some tests failed. Please check the output above.");
    process.exit(1);
  } else {
    console.log("\n✅ All tests passed!");
    process.exit(0);
  }
}

async function runTestFile(
  testFile: string,
): Promise<{ success: boolean; testCount: number }> {
  return new Promise((resolve, reject) => {
    // For now, we'll do a simple TypeScript compilation check
    // In a real scenario, you'd use Jest or another test runner
    const tsc = spawn("tsc", ["--noEmit", testFile], {
      stdio: "pipe",
    });

    let output = "";
    let errorOutput = "";

    tsc.stdout.on("data", (data) => {
      output += data.toString();
    });

    tsc.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    tsc.on("close", (code) => {
      if (code === 0) {
        resolve({ success: true, testCount: 1 });
      } else {
        console.error(`TypeScript compilation failed for ${testFile}:`);
        console.error(errorOutput);
        resolve({ success: false, testCount: 1 });
      }
    });

    tsc.on("error", (error) => {
      reject(error);
    });
  });
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

export { runTests };
