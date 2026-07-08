"use client";

import { useState } from "react";

type PropertyPhoto = {
  photo_url: string;
  sort_order: number | null;
};

export default function PhotoGallery({
  photos,
  title,
}: {
  photos: PropertyPhoto[];
  title: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  const sortedPhotos = [...(photos || [])].sort(
    (a, b) => (a.sort_order || 0) - (b.sort_order || 0)
  );

  const activePhoto = sortedPhotos[activeIndex];

  function goPrevious() {
    setActiveIndex((current) =>
      current === 0 ? sortedPhotos.length - 1 : current - 1
    );
  }

  function goNext() {
    setActiveIndex((current) =>
      current === sortedPhotos.length - 1 ? 0 : current + 1
    );
  }

  if (sortedPhotos.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-[2rem] bg-gradient-to-br from-slate-200 to-slate-100 sm:h-[420px] lg:h-[500px]">
        <div className="text-center">
          <p className="text-5xl font-black text-slate-300">K</p>
          <p className="mt-3 text-sm font-black uppercase tracking-[0.18em] text-slate-500">
            Photos coming soon
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="relative overflow-hidden rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={activePhoto.photo_url}
          alt={`${title} photo ${activeIndex + 1}`}
          className="h-[280px] w-full object-cover sm:h-[420px] lg:h-[500px]"
        />

        {sortedPhotos.length > 1 && (
          <>
            <button
              type="button"
              onClick={goPrevious}
              className="absolute left-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-2xl font-black text-slate-950 shadow-sm ring-1 ring-slate-200 transition hover:bg-white"
              aria-label="Previous photo"
            >
              ‹
            </button>

            <button
              type="button"
              onClick={goNext}
              className="absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-2xl font-black text-slate-950 shadow-sm ring-1 ring-slate-200 transition hover:bg-white"
              aria-label="Next photo"
            >
              ›
            </button>

            <div className="absolute bottom-4 right-4 rounded-full bg-slate-950/85 px-4 py-2 text-xs font-black text-white">
              {activeIndex + 1} / {sortedPhotos.length}
            </div>
          </>
        )}
      </div>

      {sortedPhotos.length > 1 && (
        <div className="mt-4 overflow-x-auto pb-2">
          <div className="flex w-max gap-3">
            {sortedPhotos.map((photo, index) => (
              <button
                key={`${photo.photo_url}-${index}`}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={`h-24 w-36 flex-shrink-0 overflow-hidden rounded-2xl bg-white shadow-sm ring-2 transition sm:h-28 sm:w-44 ${
                  activeIndex === index
                    ? "ring-slate-950"
                    : "ring-slate-200 hover:ring-slate-400"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.photo_url}
                  alt={`${title} thumbnail ${index + 1}`}
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}