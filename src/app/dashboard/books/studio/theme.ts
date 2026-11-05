// AG Studio theme for Mike's Books, mapped to the dashboard's tokens in src/app/globals.css the way PayPal's
// AG Studio boilerplate maps its own: every value is a CSS variable, so Studio reads as part of the page (white
// cards on the blue-grey ground, Figtree, Mike's Plumbing blue) and follows any change to a token.
import { studioTheme } from "ag-studio";

const token = (name: string) => `var(--${name})`;
const line = (name: string) => ({ width: 1, color: token(name) });

// Chart series in the order widgets use them: charged (paid green), held (waiting amber), then brand blues.
const PALETTE = ["ok", "wait", "brand", "brand-deep", "none-ink", "text-3"];
const palette = Object.fromEntries(
  PALETTE.flatMap((name, i) => [
    [`chartPaletteFills${i + 1}Color`, token(name)],
    [`chartPaletteStrokes${i + 1}Color`, token(name)],
  ]),
);

export const booksTheme = studioTheme.withParams({
  fontFamily: "var(--font-ui), system-ui, sans-serif",
  fontSize: 14,
  textColor: token("text"),
  foregroundColor: token("text"),
  subtleTextColor: token("text-3"),
  backgroundColor: token("card"),
  borderColor: token("line"),
  accentColor: token("brand"),
  iconColor: token("text-2"),
  rowHoverColor: token("brand-tint"),

  // No frame: the canvas is the page's own ground, and widget edges line up with the page title.
  studioWrapperBorder: false,
  studioWrapperBorderRadius: 0,
  studioWrapperSpacing: 0,
  studioWrapperBackgroundColor: token("bg"),
  studioCanvasBorder: false,
  studioCanvasBorderRadius: 0,
  studioCanvasShadow: false,
  studioCanvasBackgroundColor: token("bg"),
  studioCanvasPadding: 0,
  studioCanvasRowHeight: 18,
  studioCanvasFontFamily: "var(--font-ui), system-ui, sans-serif",

  // Widgets are the dashboard's cards: white, hairline border, 16px radius.
  studioWidgetBackgroundColor: token("card"),
  studioWidgetBorder: line("line"),
  studioWidgetBorderRadius: 16,
  studioWidgetPadding: 14,
  studioWidgetTitleFontFamily: "var(--font-ui), system-ui, sans-serif",
  studioWidgetTitleFontSize: 18,
  studioWidgetTitleFontWeight: 800,
  studioWidgetTitleTextColor: token("text"),
  studioWidgetSubtitleFontFamily: "var(--font-ui), system-ui, sans-serif",
  studioWidgetSubtitleFontSize: 13,
  studioWidgetSubtitleTextColor: token("text-3"),
  studioWidgetCaptionFontFamily: "var(--font-ui), system-ui, sans-serif",
  studioWidgetCaptionFontSize: 13,
  studioWidgetCaptionTextColor: token("text-3"),
  studioWidgetResizeBorderColor: token("brand"),
  studioWidgetLoadingOverlayBackgroundColor: token("card"),

  studioPanelContainerBackgroundColor: token("card"),
  studioPanelContainerBorder: line("line"),
  studioPanelDividerColor: token("line"),
  studioPanelDividerActiveColor: token("brand"),
  studioPanelSectionBorderColor: token("line"),
  studioPanelHeaderFontFamily: "var(--font-ui), system-ui, sans-serif",
  studioPanelHeaderFontWeight: 700,
  studioPanelChevronButtonHoverBackgroundColor: token("brand-tint"),
  studioPanelChevronButtonHoverColor: token("brand"),
  studioToggleButtonActiveBackgroundColor: token("brand-tint"),
  studioToggleButtonActiveBorderColor: token("brand"),
  studioToggleButtonActiveColor: token("brand-ink"),

  // The jobs grid: quiet grey headers, hairline rows, room for a status pill.
  gridFontFamily: "var(--font-ui), system-ui, sans-serif",
  gridFontSize: 14,
  gridCellTextColor: token("text"),
  gridHeaderBackgroundColor: "#f7f9fc",
  gridHeaderTextColor: token("text-2"),
  gridHeaderFontWeight: 600,
  gridHeaderFontSize: 13,
  gridRowHeight: 50,
  gridRowBorder: line("line"),
  gridHeaderRowBorder: line("line"),
  gridPinnedRowBorder: line("line"),
  gridRowHoverColor: token("brand-tint"),
  gridWrapperBorder: false,

  chartFontFamily: "var(--font-ui), system-ui, sans-serif",
  chartTextColor: token("text-2"),
  chartSubtleTextColor: token("text-3"),
  chartAxisLineColor: token("line"),
  chartGridLineColor: token("line"),
  ...palette,
});
