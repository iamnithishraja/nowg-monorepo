import * as React from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { classNames } from "../../lib/classNames";

interface VideoItem {
  id: string;
  url: string;
  title?: string;
  description?: string;
}

interface VideoCarouselProps {
  videos: VideoItem[];
  className?: string;
}

export function VideoCarousel({ videos, className }: VideoCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const [canScrollPrev, setCanScrollPrev] = React.useState(false);
  const [canScrollNext, setCanScrollNext] = React.useState(false);
  const [currentIndex, setCurrentIndex] = React.useState(0);

  const onSelect = React.useCallback(() => {
    if (!emblaApi) return;
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
    setCurrentIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  React.useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, onSelect]);

  const scrollPrev = React.useCallback(() => {
    emblaApi?.scrollPrev();
  }, [emblaApi]);

  const scrollNext = React.useCallback(() => {
    emblaApi?.scrollNext();
  }, [emblaApi]);

  return (
    <div
      className={classNames(
        "relative h-full w-full flex items-center justify-center bg-[#0a0a0f]",
        className
      )}
    >
      {/* Left Arrow */}
      <button
        onClick={scrollPrev}
        disabled={!canScrollPrev && videos.length <= 1}
        className={classNames(
          "absolute left-4 md:left-8 z-20 w-10 h-10 md:w-12 md:h-12 rounded-full",
          "bg-white/10 backdrop-blur-sm border border-white/20",
          "flex items-center justify-center",
          "transition-all duration-200 hover:bg-white/20 hover:scale-105",
          "disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100",
          "focus:outline-none focus:ring-2 focus:ring-purple-500/50"
        )}
        aria-label="Previous video"
      >
        <ChevronLeft className="w-5 h-5 md:w-6 md:h-6 text-white" />
      </button>

      {/* Carousel Container */}
      <div className="w-full h-full flex items-center justify-center px-16 md:px-24 lg:px-32">
        <div
          ref={emblaRef}
          className="overflow-hidden w-full max-w-4xl h-full max-h-[80vh]"
        >
          <div className="flex h-full">
            {videos.map((video, index) => (
              <div
                key={video.id}
                className="flex-[0_0_100%] min-w-0 h-full flex items-center justify-center px-2"
              >
                <div className="relative w-full h-full max-h-[70vh] rounded-2xl overflow-hidden shadow-2xl shadow-purple-500/20 bg-black">
                  {/* Video Container with Laptop-style frame */}
                  <div className="relative w-full h-full">
                    {/* Top bar (browser-like) */}
                    <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-gray-800 to-gray-900 flex items-center px-3 z-10 rounded-t-2xl">
                      <div className="flex gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                      </div>
                      <div className="flex-1 flex justify-center">
                        <div className="bg-gray-700/50 rounded-md px-4 py-0.5 text-[10px] text-gray-400">
                          {video.title || `Preview ${index + 1}`}
                        </div>
                      </div>
                    </div>

                    {/* Video */}
                    <video
                      autoPlay
                      muted
                      loop
                      playsInline
                      className="w-full h-full object-cover pt-8"
                    >
                      <source src={video.url} type="video/mp4" />
                    </video>

                    {/* Subtle gradient overlay at bottom */}
                    <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Arrow */}
      <button
        onClick={scrollNext}
        disabled={!canScrollNext && videos.length <= 1}
        className={classNames(
          "absolute right-4 md:right-8 z-20 w-10 h-10 md:w-12 md:h-12 rounded-full",
          "bg-white/10 backdrop-blur-sm border border-white/20",
          "flex items-center justify-center",
          "transition-all duration-200 hover:bg-white/20 hover:scale-105",
          "disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100",
          "focus:outline-none focus:ring-2 focus:ring-purple-500/50"
        )}
        aria-label="Next video"
      >
        <ChevronRight className="w-5 h-5 md:w-6 md:h-6 text-white" />
      </button>

      {/* Dot Indicators */}
      {videos.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-20">
          {videos.map((_, index) => (
            <button
              key={index}
              onClick={() => emblaApi?.scrollTo(index)}
              className={classNames(
                "w-2 h-2 rounded-full transition-all duration-200",
                index === currentIndex
                  ? "bg-white w-6"
                  : "bg-white/40 hover:bg-white/60"
              )}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default VideoCarousel;
