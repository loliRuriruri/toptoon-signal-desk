# Taiwan behaviors

- The homepage exposes ranked character links and localized Traditional Chinese names.
- The catalog response includes name, thumbnail, hashtags, view count, chat count, likes, follows, visibility, and release time.
- The first sorted hashtag is used as the public work/category label, matching the existing JP and Global extraction convention.
- Detail hero artwork uses the same public thumbnail source at a larger resize. The source image is portrait (observed example: 832 x 1216), while the official page applies `object-fit: cover` in several containers.
- Tracker decision: compact list thumbnails remain cropped for scanability; clicking a character opens a large `object-fit: contain` artwork viewer with the entire source image visible.
