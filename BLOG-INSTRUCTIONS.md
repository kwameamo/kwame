# How to Add Blog Posts

## Quick Guide

Edit the `blog-posts.json` file to add or edit blog posts. The dates are automatically generated based on the order of posts.

## Adding a New Post

1. Open `blog-posts.json`
2. Add a new entry at the top of the array (it will appear as the newest post)
3. Give it a unique `id` (use the next number in sequence)
4. Add your `title`, `excerpt`, and `content`

## Example Post Structure

```json
{
  "id": 5,
  "title": "Your Post Title Here",
  "excerpt": "A short description of what this post is about (1-2 sentences).",
  "content": "<p>Your full blog post content goes here.</p><p>Use HTML tags for formatting.</p><h2>Subheadings</h2><p>More content...</p>"
}
```

## Content Formatting

Use these HTML tags in your content:
- `<p>...</p>` for paragraphs
- `<h2>...</h2>` for section headings
- `<strong>...</strong>` for bold text
- `<em>...</em>` for italic text

## How Dating Works

Posts are automatically dated based on their position:
- The first post (highest ID) = Today's date
- Second post = 2 days ago
- Third post = 4 days ago
- And so on...

This means newer posts should have higher IDs and be placed at the top of the JSON array.

## Example: Adding a New Post

If your current highest ID is 4, add this at the top of the array in `blog-posts.json`:

```json
[
  {
    "id": 5,
    "title": "My New Post",
    "excerpt": "This is my newest blog post.",
    "content": "<p>The full content of my post goes here.</p>"
  },
  {
    "id": 4,
    "title": "Previous Post",
    ...
  }
]
```

That's it! The blog will automatically show your new post with today's date.
