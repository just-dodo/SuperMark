/**
 * ffprobe wrapper for extracting media file metadata.
 */

import ffmpeg from "fluent-ffmpeg";

export interface MediaMetadata {
  duration?: number;
  codec?: string;
  bitrate?: number;
  width?: number;
  height?: number;
  channels?: number;
  sampleRate?: number;
}

export function getMediaMetadata(filePath: string): Promise<MediaMetadata> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) {
        reject(err);
        return;
      }

      const stream = data.streams[0];
      resolve({
        duration: data.format.duration,
        codec: stream?.codec_name,
        bitrate: data.format.bit_rate ? Number(data.format.bit_rate) : undefined,
        width: stream?.width,
        height: stream?.height,
        channels: stream?.channels,
        sampleRate: stream?.sample_rate ? Number(stream.sample_rate) : undefined,
      });
    });
  });
}
