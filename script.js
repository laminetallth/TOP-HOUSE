document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-search-input]').forEach((input) => {
    const target = input.dataset.searchInput;
    const items = [...document.querySelectorAll(`[data-search-group="${target}"] [data-search-item]`)];
    const empty = document.querySelector(`[data-empty-for="${target}"]`);

    const runSearch = () => {
      const query = input.value.trim().toLowerCase();
      let shown = 0;

      items.forEach((element) => {
        const matches = element.dataset.searchItem.toLowerCase().includes(query);
        element.classList.toggle('is-hidden', !matches);
        if (matches) shown += 1;
      });

      if (empty) {
        empty.style.display = shown ? 'none' : 'block';
      }
    };

    input.addEventListener('input', runSearch);
    runSearch();
  });
});
