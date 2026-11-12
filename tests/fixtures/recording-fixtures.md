# Recorder export fixtures

Synthetic 60-second navy video (64×36, 20 FPS) with silent mono audio; no user media.

Generated with FFmpeg:

```sh
ffmpeg -f lavfi -i color=c=navy:size=64x36:rate=20 -f lavfi -i anullsrc=r=48000:cl=mono -t 60 -c:v libx264 -pix_fmt yuv420p -preset ultrafast -c:a aac -movflags frag_keyframe+empty_moov -frag_duration 1000000 recording-live.mp4
ffmpeg -i recording-live.mp4 -c:v libvpx -deadline realtime -cpu-used 8 -b:v 50k -c:a libopus -live 1 recording-live.webm
```

The MP4 models fragmented MediaRecorder output; the live WebM lacks a duration and seek index. Tests also replace its finalized duration with 3 seconds to reproduce the reported metadata issue while retaining all 60 seconds of media.
