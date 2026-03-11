import { describe, it, expect } from "vitest";
import { route } from "../../src/analyzers/index.js";
import { analyzeText } from "../../src/analyzers/text.js";
import { analyzeDocument } from "../../src/analyzers/document.js";
import { analyzeImage } from "../../src/analyzers/image.js";
import { analyzeAudio } from "../../src/analyzers/audio.js";
import { analyzeVideo } from "../../src/analyzers/video.js";
import { analyzeUrl } from "../../src/analyzers/url.js";
import { analyzeData } from "../../src/analyzers/data.js";
import { analyzeBinary } from "../../src/analyzers/binary.js";

describe("route", () => {
  it("routes .ts to text analyzer", () => {
    expect(route(".ts")).toBe(analyzeText);
  });

  it("routes .js to text analyzer", () => {
    expect(route(".js")).toBe(analyzeText);
  });

  it("routes .py to text analyzer", () => {
    expect(route(".py")).toBe(analyzeText);
  });

  it("routes .pdf to document analyzer", () => {
    expect(route(".pdf")).toBe(analyzeDocument);
  });

  it("routes .docx to document analyzer", () => {
    expect(route(".docx")).toBe(analyzeDocument);
  });

  it("routes .png to image analyzer", () => {
    expect(route(".png")).toBe(analyzeImage);
  });

  it("routes .jpg to image analyzer", () => {
    expect(route(".jpg")).toBe(analyzeImage);
  });

  it("routes .mp3 to audio analyzer", () => {
    expect(route(".mp3")).toBe(analyzeAudio);
  });

  it("routes .wav to audio analyzer", () => {
    expect(route(".wav")).toBe(analyzeAudio);
  });

  it("routes .mp4 to video analyzer", () => {
    expect(route(".mp4")).toBe(analyzeVideo);
  });

  it("routes .mov to video analyzer", () => {
    expect(route(".mov")).toBe(analyzeVideo);
  });

  it("routes .url to url analyzer", () => {
    expect(route(".url")).toBe(analyzeUrl);
  });

  it("routes .webloc to url analyzer", () => {
    expect(route(".webloc")).toBe(analyzeUrl);
  });

  it("routes .csv to data analyzer", () => {
    expect(route(".csv")).toBe(analyzeData);
  });

  it("routes .json to data analyzer", () => {
    expect(route(".json")).toBe(analyzeData);
  });

  it("routes unknown extension .xyz to binary analyzer", () => {
    expect(route(".xyz")).toBe(analyzeBinary);
  });
});
