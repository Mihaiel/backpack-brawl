#import "@preview/ilm:3.0.0": *

#set text(lang: "en")

#show: ilm.with(
  title: [Development Diary],
  authors: (
    "Mihaiel Birta",
    // Add additional authors here.
  ),
  date: datetime(year: 2026, month: 11, day: 25),
  abstract: [
    The following report documents the development of the 'Backpack Brawl' game.
  ],
)

// Display cover page.
#cover-page()

// Display table of contents.
#outline()

= Layout