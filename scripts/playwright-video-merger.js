#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Configuration
const VIDEO_DIR = 'test-results';
const OUTPUT_DIR = 'processed_videos';
const FREEZE_FRAMES_DIR = 'freeze_frames';
const CONCAT_FILE = 'file_list.txt';
const FINAL_OUTPUT = 'final_output.mp4';
const TEXT_WRAP_LIMIT = 40;

// Ensure output directories exist
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
if (!fs.existsSync(FREEZE_FRAMES_DIR)) fs.mkdirSync(FREEZE_FRAMES_DIR, { recursive: true });

// Clean up old files
const cleanupPattern = (dir, pattern) => {
  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      if (file.endsWith(pattern)) {
        fs.unlinkSync(path.join(dir, file));
      }
    });
  }
};

cleanupPattern(OUTPUT_DIR, '.mp4');
cleanupPattern(FREEZE_FRAMES_DIR, '.mp4');
cleanupPattern(FREEZE_FRAMES_DIR, '.jpg');
if (fs.existsSync(CONCAT_FILE)) fs.unlinkSync(CONCAT_FILE);

console.log('Processing Playwright test videos with a 1-second delay and wrapped subtitles...');

// Find all video.webm files recursively
function findVideoFiles(dir) {
  const results = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      results.push(...findVideoFiles(fullPath));
    } else if (item.name === 'video.webm') {
      results.push(fullPath);
    }
  }

  return results;
}

const videoFiles = findVideoFiles(VIDEO_DIR);
console.log(`Found ${videoFiles.length} video files`);

const concatList = [];

videoFiles.forEach((videoFile, index) => {
  const testDir = path.dirname(videoFile);
  const testName = path.basename(testDir);

  console.log(`[${index + 1}/${videoFiles.length}] Processing: ${testName}`);

  // Try to read test title
  const titleFile = path.join(testDir, 'test-title.txt');
  let testNameClean;

  if (fs.existsSync(titleFile)) {
    testNameClean = fs.readFileSync(titleFile, 'utf8').trim();
  } else {
    testNameClean = testName.replace(/-/g, ' ');
  }

  // Wrap text if too long
  if (testNameClean.length > TEXT_WRAP_LIMIT) {
    const regex = new RegExp(`(.{1,${TEXT_WRAP_LIMIT}}) `, 'g');
    testNameClean = testNameClean.replace(regex, '$1\n');
  }

  const outputFile = path.join(OUTPUT_DIR, `${testName}.mp4`);
  const freezeFrameJpg = path.join(FREEZE_FRAMES_DIR, `${testName}.jpg`);
  const freezeFrameFile = path.join(FREEZE_FRAMES_DIR, `${testName}_freeze.mp4`);

  try {
    // Convert webm to mp4 with text overlay
    execSync(
      `ffmpeg -loglevel error -i "${videoFile}" -vf "drawtext=text='${testNameClean}':fontcolor=white:fontsize=24:x=(w-text_w)/2:y=h-text_h-30:box=1:boxcolor=black@0.5:boxborderw=5:line_spacing=10" -c:v libx264 -crf 23 -preset fast -c:a aac -b:a 128k "${outputFile}" -y`,
      { stdio: 'inherit' }
    );

    // Extract last frame
    execSync(
      `ffmpeg -loglevel error -sseof -0.1 -i "${outputFile}" -vframes 1 -q:v 2 "${freezeFrameJpg}" -y`,
      { stdio: 'inherit' }
    );

    // Create 1-second freeze frame video
    execSync(
      `ffmpeg -loglevel error -loop 1 -t 1 -i "${freezeFrameJpg}" -vf "scale=1280:-2" -c:v libx264 -crf 23 -preset fast -tune stillimage -pix_fmt yuv420p "${freezeFrameFile}" -y`,
      { stdio: 'inherit' }
    );

    // Add to concat list
    concatList.push(`file '${outputFile}'`);
    concatList.push(`file '${freezeFrameFile}'`);

  } catch (error) {
    console.error(`Error processing ${testName}:`, error.message);
  }
});

// Write concat file
if (concatList.length > 0) {
  fs.writeFileSync(CONCAT_FILE, concatList.join('\n'));

  console.log('\nConcatenating all processed videos with delays...');

  try {
    execSync(
      `ffmpeg -loglevel error -f concat -safe 0 -i "${CONCAT_FILE}" -c:v libx264 -crf 23 -preset fast -c:a aac -b:a 128k "${FINAL_OUTPUT}" -y`,
      { stdio: 'inherit' }
    );

    console.log(`\n✅ Done! Final video saved as: ${FINAL_OUTPUT}`);
  } catch (error) {
    console.error('Error concatenating videos:', error.message);
  }
} else {
  console.error('❌ No valid videos found to concatenate!');
}
