# How to Add Blog Posts

## Quick Guide

Edit the `blog-posts.json` file to add or edit blog posts. You specify the exact date for each post.

## Adding a New Post

1. Open `blog-posts.json`
2. Add a new entry
3. Give it a unique `id` (use the next number in sequence)
4. Add the **exact date** you're posting (format: YYYY-MM-DD)
5. Add your `title`, `excerpt`, and `content`

## Example Post Structure

```json
{
  "id": 5,
  "date": "2026-02-14",
  "title": "Your Post Title Here",
  "excerpt": "A short description of what this post is about (1-2 sentences).",
  "content": "<p>Your full blog post content goes here.</p><p>Use HTML tags for formatting.</p><h2>Subheadings</h2><p>More content...</p>"
}
```

## Date Format

Use `YYYY-MM-DD` format (e.g., `2026-02-14` for February 14, 2026)

The blog will automatically:
- Sort posts by date (newest first)
- Display the date as "Feb 14, 2026"

## Content Formatting

Use these HTML tags in your content:
- `<p>...</p>` for paragraphs
- `<h2>...</h2>` for section headings
- `<strong>...</strong>` for bold text
- `<em>...</em>` for italic text

## Example: Adding a New Post Today

```json
[
  {
    "id": 5,
    "date": "2026-02-14",
    "title": "My New Post",
    "excerpt": "This is my newest blog post.",
    "content": "<p>The full content of my post goes here.</p>"
  },
  {
    "id": 4,
    "date": "2026-02-05",
    "title": "Previous Post",
    ...
  }
]
```

That's it! Just add the date when you create the post and it will display correctly.