import { useRef, useState } from "react";

export default function ProductImageZoom() {
  const [showZoom, setShowZoom] = useState(false);
  const [zoomPosition, setZoomPosition] = useState({ x: 0, y: 0 });
  const imageRef = useRef(null);

  // Sample product images - ganti dengan images kamu
  const [selectedImage, setSelectedImage] = useState(
    "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&h=800&fit=crop",
  );

  const thumbnails = [
    "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&h=800&fit=crop",
    "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=800&h=800&fit=crop",
    "https://images.unsplash.com/photo-1560343090-f0409e92791a?w=800&h=800&fit=crop",
    "https://images.unsplash.com/photo-1511556820780-d912e42b4980?w=800&h=800&fit=crop",
  ];

  const handleMouseMove = (e) => {
    if (!imageRef.current) return;

    const rect = imageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setZoomPosition({ x, y });
  };

  const handleMouseEnter = () => {
    setShowZoom(true);
  };

  const handleMouseLeave = () => {
    setShowZoom(false);
  };

  return (
    <div className="min-h-screen p-8 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-6xl mx-auto">
        <div className="overflow-hidden bg-white shadow-xl rounded-2xl">
          <div className="grid gap-8 p-8 md:grid-cols-2">
            {/* Image Section */}
            <div className="space-y-4">
              {/* Main Image dengan Zoom Effect */}
              <div
                ref={imageRef}
                className="relative overflow-hidden bg-gray-100 rounded-xl cursor-crosshair aspect-square"
                onMouseMove={handleMouseMove}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
              >
                <img
                  src={selectedImage}
                  alt="Product"
                  className="object-cover w-full h-full transition-opacity duration-200"
                  style={{ opacity: showZoom ? 0.5 : 1 }}
                />

                {/* Zoomed Image Overlay */}
                {showZoom && (
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      backgroundImage: `url(${selectedImage})`,
                      backgroundSize: "150%",
                      backgroundPosition: `${zoomPosition.x}% ${zoomPosition.y}%`,
                      backgroundRepeat: "no-repeat",
                    }}
                  />
                )}

                {/* Zoom Indicator */}
                {showZoom && (
                  <div className="absolute top-4 right-4 bg-black/70 text-white px-3 py-1.5 rounded-full text-sm font-medium">
                    🔍 Zoom Active
                  </div>
                )}
              </div>

              {/* Thumbnail Gallery */}
              <div className="grid grid-cols-4 gap-3">
                {thumbnails.map((thumb, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImage(thumb)}
                    className={`aspect-square rounded-lg overflow-hidden border-2 transition-all duration-200 hover:scale-105 ${
                      selectedImage === thumb
                        ? "border-blue-500 shadow-lg"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <img
                      src={thumb}
                      alt={`Thumbnail ${index + 1}`}
                      className="object-cover w-full h-full"
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Product Details Section */}
            <div className="space-y-6">
              <div>
                <span className="inline-block px-3 py-1 mb-3 text-sm font-semibold text-blue-700 bg-blue-100 rounded-full">
                  New Arrival
                </span>
                <h1 className="mb-2 text-4xl font-bold text-gray-900">
                  Premium Watch Collection
                </h1>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center">
                    {[...Array(5)].map((_, i) => (
                      <svg
                        key={i}
                        className="w-5 h-5 text-yellow-400 fill-current"
                        viewBox="0 0 20 20"
                      >
                        <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                      </svg>
                    ))}
                  </div>
                  <span className="text-gray-600">(128 reviews)</span>
                </div>
              </div>

              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-bold text-gray-900">$299</span>
                <span className="text-2xl text-gray-400 line-through">
                  $399
                </span>
                <span className="px-3 py-1 text-sm font-semibold text-red-700 bg-red-100 rounded-full">
                  -25%
                </span>
              </div>

              <p className="leading-relaxed text-gray-600">
                Elevate your style with this premium timepiece. Crafted with
                precision and attention to detail, featuring a sophisticated
                design that complements any outfit. Water-resistant and built to
                last.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block mb-2 text-sm font-semibold text-gray-900">
                    Color
                  </label>
                  <div className="flex gap-2">
                    {[
                      "bg-black",
                      "bg-blue-500",
                      "bg-gray-300",
                      "bg-rose-400",
                    ].map((color, index) => (
                      <button
                        key={index}
                        className={`w-10 h-10 rounded-full ${color} border-2 border-gray-300 hover:scale-110 transition-transform`}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block mb-2 text-sm font-semibold text-gray-900">
                    Size
                  </label>
                  <div className="flex gap-2">
                    {["S", "M", "L", "XL"].map((size) => (
                      <button
                        key={size}
                        className="px-6 py-2 font-medium transition-colors border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50"
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button className="flex-1 py-4 font-semibold text-white transition-colors bg-blue-600 shadow-lg hover:bg-blue-700 rounded-xl shadow-blue-200">
                  Add to Cart
                </button>
                <button className="px-6 py-4 transition-colors border-2 border-gray-300 rounded-xl hover:bg-gray-50">
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                    />
                  </svg>
                </button>
              </div>

              <div className="pt-6 space-y-3 text-sm text-gray-600 border-t">
                <div className="flex items-center gap-3">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span>Free shipping on orders over $50</span>
                </div>
                <div className="flex items-center gap-3">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span>30-day return guarantee</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="p-6 mt-8 border border-blue-200 bg-blue-50 rounded-xl">
          <h3 className="mb-2 text-lg font-semibold text-blue-900">
            💡 Cara Pakai Zoom Effect:
          </h3>
          <ul className="space-y-2 text-blue-800">
            <li>• Hover mouse kamu di atas gambar produk utama</li>
            <li>• Geser-geser mouse untuk melihat detail produk dengan zoom</li>
            <li>• Klik thumbnail di bawah untuk ganti gambar</li>
            <li>• Zoom level bisa diatur di backgroundSize (sekarang 250%)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
