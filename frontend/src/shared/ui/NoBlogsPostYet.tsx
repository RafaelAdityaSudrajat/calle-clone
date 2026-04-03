const NoBlogsPostYet = () => {
  return (
    <section className="pt-5 pb-[6rem] text-primary">
      <div className="px-2 mx-auto text-center">
        {/* Heading */}
        <h2 className="text-[1.2rem] mb-6">Shop Blog</h2>

        <p className="mt-2 text-[1.2rem] mb-[6rem]">
          Discover our latest events, stories, and promotions here!
        </p>

        {/* Empty State */}
        <div className="flex flex-col items-center mt-14">
          {/* Icon Placeholder */}
          <img
            src="https://d2nvjoftj891ay.cloudfront.net/hotfix-relea.94f50e0/empty_box.CmT8f_pO.svg"
            alt=""
          />

          <h3 className="text-[1rem]">No Blog Posts Yet</h3>

          <p className="mt-1 text-[.9rem]">
            Stay tuned for our latest updates and stories.
          </p>
        </div>
      </div>
    </section>
  );
};

export default NoBlogsPostYet;
