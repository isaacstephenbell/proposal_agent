#!/usr/bin/env tsx

require("dotenv").config({ path: ".env.local" });
import { supabaseAdmin } from "./src/lib/supabase";
import { readFileSync } from "fs";

async function prepareAndTestFunctions() {
  console.log(" Preparing Database Functions for Upload...\n");

  try {
    // Read the blocks schema file
    const blocksSchema = readFileSync("blocks-schema.sql", "utf8");
    
    console.log(" STEP 1: Manual Upload Required");
    console.log("===============================================");
    console.log("Due to Supabase security restrictions, you need to manually upload the functions.");
    console.log("");
    console.log("Instructions:");
    console.log("1. Go to your Supabase dashboard");
    console.log("2. Navigate to SQL Editor");  
    console.log("3. Copy the ENTIRE contents of blocks-schema.sql");
    console.log("4. Paste it into the SQL Editor");
    console.log("5. Click RUN to execute");
    console.log("");
    console.log("File to copy: blocks-schema.sql");
    console.log("File size:", blocksSchema.length, "characters");
    console.log("");
    
    // Test current functions first
    console.log(" STEP 2: Testing Current Functions");
    console.log("===============================================");
    await testFunctions();
    
    console.log("\n STEP 3: After Upload, Run This Script Again");
    console.log("===============================================");
    console.log("After uploading via Supabase dashboard, run:");
    console.log("npx tsx upload-functions.ts");
    console.log("This will verify all functions are working correctly.");
    
  } catch (error) {
    console.error(" Script failed:", error);
  }
}

async function testFunctions() {
  const tests = [
    { name: "match_proposals", params: { query_embedding: new Array(1536).fill(0.1), match_threshold: 0.1, match_count: 1, filter_author: null, filter_sector: null, filter_client: null, filter_tags: null } },
    { name: "match_blocks", params: { query_embedding: new Array(1536).fill(0.1), match_threshold: 0.1, match_count: 1, filter_author: null, filter_tags: null, exclude_block_ids: null } },
    { name: "update_block_usage", params: { block_id: "00000000-0000-0000-0000-000000000000" } },
    { name: "get_popular_blocks", params: { limit_count: 1, filter_author: null, filter_tags: null } },
    { name: "get_recent_blocks", params: { limit_count: 1, filter_author: null, filter_tags: null } }
  ];

  console.log("Testing existing functions...");
  for (const test of tests) {
    try {
      const { error } = await supabaseAdmin.rpc(test.name, test.params);
      if (error) {
        console.log(`    ${test.name}: ${error.message}`);
      } else {
        console.log(`    ${test.name}: Working`);
      }
    } catch (e) {
      console.log(`    ${test.name}: Not found or failed`);
    }
  }
}

prepareAndTestFunctions().catch(console.error);
