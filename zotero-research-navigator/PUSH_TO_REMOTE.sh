#!/bin/bash

# 🚀 Zotero Research Navigator - Push to Remote Repository Script
# 
# This script helps you push the zotero-plugin branch to your remote repository
# 
# Usage:
#   1. Set your repository URL below
#   2. Run: chmod +x PUSH_TO_REMOTE.sh
#   3. Run: ./PUSH_TO_REMOTE.sh

echo "🚀 Zotero Research Navigator - Remote Push Script"
echo "=================================================="

# 🔧 Configuration - REPLACE WITH YOUR REPOSITORY URL
REMOTE_URL="https://github.com/YOUR_USERNAME/YOUR_REPOSITORY_NAME.git"

echo "📁 Current directory: $(pwd)"
echo "🌿 Current branch: $(git branch --show-current)"
echo "📦 Repository URL will be: $REMOTE_URL"
echo ""

# Check if this looks like our project
if [ ! -f "zotero-research-navigator-v1.0.0.xpi" ]; then
    echo "❌ Error: XPI file not found. Are you in the right directory?"
    exit 1
fi

echo "✅ Found XPI file - looks like the right project!"
echo ""

# Show current status
echo "📋 Current Git Status:"
git status --short
echo ""

echo "📊 Commit History:"
git log --oneline --graph -5
echo ""

# Instructions for user
echo "🔧 To push to your remote repository:"
echo ""
echo "1️⃣ First, update the REMOTE_URL in this script with your actual repository URL"
echo "   Example: https://github.com/yourusername/tree-style-history.git"
echo ""
echo "2️⃣ Then run these commands:"
echo ""
echo "   # Add your remote repository"
echo "   git remote add origin $REMOTE_URL"
echo ""
echo "   # Push the zotero-plugin branch"
echo "   git push -u origin zotero-plugin"
echo ""
echo "   # Or if you want to push to main branch instead:"
echo "   git checkout main"
echo "   git push -u origin main"
echo ""

echo "3️⃣ Alternative: Push both branches"
echo ""
echo "   # Push main branch"
echo "   git push origin main"
echo ""
echo "   # Push zotero-plugin branch"
echo "   git push origin zotero-plugin"
echo ""

echo "🎯 Recommended Next Steps After Push:"
echo ""
echo "   • Create a new release on GitHub"
echo "   • Upload the XPI file to releases"
echo "   • Update repository description"
echo "   • Add installation instructions to README"
echo ""

echo "📦 Key Files Ready for Distribution:"
echo "   • zotero-research-navigator-v1.0.0.xpi (12.5KB) - Plugin file"
echo "   • INSTALL.md - Installation guide"  
echo "   • README.md - Project documentation"
echo "   • TRANSFER_GUIDE.md - Deployment guide"
echo ""

echo "✨ Your Zotero Research Navigator is ready to share with the world!"

# Uncomment the following lines if you want the script to automatically push
# (Make sure to set the correct REMOTE_URL first!)

# echo "🚀 Auto-push is disabled. To enable:"
# echo "   1. Set correct REMOTE_URL above"
# echo "   2. Uncomment the push commands in this script"

# AUTO_PUSH=false
# if [ "$AUTO_PUSH" = true ]; then
#     echo "🚀 Starting automatic push..."
#     
#     # Add remote if it doesn't exist
#     if ! git remote get-url origin >/dev/null 2>&1; then
#         echo "📡 Adding remote repository..."
#         git remote add origin $REMOTE_URL
#     fi
#     
#     # Push the current branch
#     echo "📤 Pushing zotero-plugin branch..."
#     git push -u origin zotero-plugin
#     
#     echo "✅ Push completed!"
# fi