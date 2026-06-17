import { HiArrowLeft, HiLockClosed, HiOutlineTag } from "react-icons/hi";
import { HiChevronRight } from "react-icons/hi2";
import InsetInput from "./InsetInput";
import InsetInputAdress from "./InsetInputAddress";
import CountryDropdown from "./CountryDropdown";

const Checkout = () => {
  return (
    <div>
      <header
        className={`
        w-full bg-white 
        border-b top-0 left-0 sticky border-slate-200 
        h-16 md:h-20 
        flex items-center justify-between 
        px-padding_primary md:px-padding_primary 
      `}
      >
        {/* Kiri: Tombol Back dengan Micro-interaction halus */}
        <div className="flex items-center">
          <button
            type="button"
            className="p-2 -ml-2 transition-all duration-200 rounded-full text-slate-900 hover:text-black hover:bg-slate-50 active:scale-90"
            aria-label="Go back"
          >
            <HiArrowLeft className="text-xl stroke-2 md:text-2xl" />
          </button>
        </div>

        {/* Kanan: Logo / Teks Brand Utama */}
        <div className="flex items-center">
          <h1 className="text-3xl text-black font-blac md:text-4xl">CALLE</h1>
        </div>
        <div className=""></div>
      </header>

      <div className="flex flex-col w-full py-5 lg:flex-row gap-x-3">
        <div className="flex flex-col flex-[2] w-full p-padding_primary">
          {/* address details */}
          <section className="flex flex-col gap-4">
            <h2 className="text-[20px] text-[#0f172a] tracking-tight">
              Address Details
            </h2>

            {/* Email Input + Helper Text */}
            <div className="flex flex-col">
              <InsetInput placeholder="Enter your email" type="email" />
              <span className="text-[11px] text-slate-500 mt-1.5 ml-1 font-medium">
                We will send your order detail to your email
              </span>
            </div>

            {/* Recipient Full Name */}
            <InsetInput type="text" placeholder="Enter your FullName" />

            {/* Recipient Phone Number */}
            <InsetInput placeholder="Enter phone number" type="text" />

            {/* Recipient Country */}
            <CountryDropdown />

            {/* Recipient Address Details*/}
            <InsetInputAdress placeholder="Adress Details" />
            {/* Dropship Checkbox Row */}
            <div className="flex items-center justify-between py-3 mt-1">
              <span className="text-xs text-[#0f172a]">
                Make as a dropship order
              </span>
              <input
                type="checkbox"
                className="w-4 h-4 border-2 rounded cursor-pointer border-slate-300 text-slate-900 focus:ring-0 focus:ring-offset-0"
              />
            </div>
          </section>

          {/* payment method */}
          <section className="flex flex-col gap-4">
            <h2 className="text-[20px] text-[#0f172a] tracking-tight">
              Payment Method
            </h2>

            {/* QRIS Selector Box */}
            <div className="flex items-center justify-between w-full p-4 transition-colors bg-white border shadow-sm cursor-pointer border-slate-200 rounded-xl hover:bg-slate-50">
              {/* Moking logo QRIS dengan gaya teks bold dan geometris */}
              <div className="flex items-center">
                <span className="text-[18px] font-black tracking-tighter text-slate-900 italic border-2 border-slate-900 px-2.5 py-0.5 rounded-md bg-slate-50">
                  QRIS
                </span>
              </div>

              {/* Bagian Kanan: Label teks & Ikon Panah */}
              <div className="flex items-center gap-1 text-slate-500">
                <span className="text-[14px] uppercase tracking-wider text-slate-700">
                  QRIS
                </span>
                <HiChevronRight className="text-xl stroke-2 text-slate-800" />
              </div>
            </div>
          </section>
        </div>

        <div className="flex flex-col flex-1 w-full gap-5 font-sans bg-white p-padding_primary">
          {/* 1. KONTEN ATAS: Di dalam kotak ber-border */}
          <div className="flex flex-col gap-4 p-5 bg-white border shadow-sm border-slate-200 rounded-2xl">
            {/* Item produk */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-4">
                {/* Thumbnail Produk (Simulasi buku merah sesuai gambar) */}
                <div className="flex items-center justify-center flex-shrink-0 w-12 border rounded shadow-sm h-14 bg-rose-600 border-slate-100">
                  <div className="w-2 h-full ml-1 mr-auto bg-white/20"></div>{" "}
                  {/* Detail aksen buku */}
                </div>

                {/* Detail teks produk */}
                <div className="flex flex-col justify-center">
                  <h3 className="text-[15px] font-extrabold text-slate-900 uppercase tracking-tight">
                    BOOK
                  </h3>
                  <span className="text-[13px] text-slate-400 font-medium mt-0.5">
                    Quantity: 1
                  </span>
                </div>
              </div>

              {/* Harga Produk */}
              <span className="text-[15px] font-extrabold text-slate-900 whitespace-nowrap">
                Rp 229,000
              </span>
            </div>

            {/* Baris Pesan Pengiriman */}
            <div className="w-full border border-slate-200 rounded-xl px-4 py-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors mt-2">
              <span className="text-[14px] font-bold text-slate-500">
                Leave a message for delivery (Optional)
              </span>
              <HiChevronRight className="text-lg stroke-2 text-slate-800" />
            </div>

            {/* Baris Voucher */}
            <div className="w-full border border-slate-200 rounded-xl px-4 py-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3 text-slate-500">
                <HiOutlineTag className="text-xl stroke-2 text-slate-600" />
                <span className="text-[14px] font-bold text-slate-500">
                  Vouchers
                </span>
              </div>
              <HiChevronRight className="text-lg stroke-2 text-slate-800" />
            </div>
          </div>

          {/* 2. RINCIAN PEMBAYARAN (BREAKDOWN) */}
          <div className="flex flex-col gap-3 px-1 mt-1">
            {/* Subtotal */}
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-extrabold text-slate-800">
                Subtotal • 1 items
              </span>
              <span className="text-[15px] font-extrabold text-slate-800">
                Rp 229,000
              </span>
            </div>

            {/* Shipping */}
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-extrabold text-slate-800">
                Shipping
              </span>
              <span className="text-[15px] font-extrabold text-slate-800">
                -
              </span>
            </div>

            {/* Garis Pembatas tipis */}
            <div className="w-full my-1 border-t border-slate-200"></div>

            {/* Total Payment */}
            <div className="flex items-center justify-between">
              <span className="text-[16px] font-extrabold text-slate-900">
                Total Payment
              </span>
              <span className="text-[18px] font-black text-slate-900 tracking-tight">
                Rp 229,000
              </span>
            </div>
          </div>

          {/* 3. TEKS KEAMANAN */}
          <div className="flex items-center justify-center gap-1.5 text-slate-400 text-[12px] font-semibold tracking-wide mt-1">
            <HiLockClosed className="text-sm text-slate-400" />
            <span>Secure Payment | Your payment is encrypted.</span>
          </div>

          {/* 4. BANNER INFORMASI PAJAK / BEA MASUK */}
          <div className="w-full bg-[#edf2ff] border border-indigo-100 rounded-xl p-4 text-center">
            <p className="text-[13px] font-bold text-[#3b4f8c] leading-relaxed tracking-tight">
              Import duty or tax might be charged depending on your delivery
              country.
            </p>
          </div>

          {/* 5. TOMBOL AKSI UTAMA */}
          <div className="flex flex-col items-center gap-2.5 mt-2 w-full">
            <button
              type="button"
              className="
            w-full 
            bg-[#1e293b] hover:bg-[#0f172a] 
            text-white 
            py-4 
            rounded-xl 
            text-[16px] font-bold 
            transition-all 
            shadow-sm 
            active:scale-[0.98]
          "
            >
              Order Now
            </button>

            {/* Aturan & Ketentuan */}
            <p className="text-[12px] text-slate-500 font-medium tracking-tight">
              By placing your order, you agree to our{" "}
              <a
                href="#"
                className="font-bold underline text-slate-700 hover:text-black"
              >
                Terms & Conditions
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
