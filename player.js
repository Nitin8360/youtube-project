const API_KEY = 'AIzaSyB2MEJPXj44OhXvOqUCPZDQFzBS8hEryaA';
const urlParams = new URLSearchParams(window.location.search);
const videoId = urlParams.get('videoId');

let nextPageToken = '';
let categoryId = '';
let isFetching = false;

// Set player
document.getElementById('main-player').src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;

// Initial fetch
fetchVideoDetailsAndRecommend();

// ⛏ Get current video’s category
async function fetchVideoDetailsAndRecommend() {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${API_KEY}`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        const currentVideo = data.items[0];
        categoryId = currentVideo.snippet.categoryId;
        loadMoreRecommendations(); // First load
    } catch (err) {
        console.error("Failed to get video details:", err);
    }
}

// 🧠 Load more recommendations (by category + token)
async function loadMoreRecommendations() {
    if (isFetching || !categoryId) return;
    isFetching = true;

    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,status&chart=mostPopular&regionCode=IN&videoCategoryId=${categoryId}&maxResults=8&pageToken=${nextPageToken}&key=${API_KEY}`;

    try {
        const res = await fetch(url);
        const data = await res.json();
        nextPageToken = data.nextPageToken || '';
        const filtered = data.items.filter(video =>
            video.id !== videoId && video.status.embeddable
        );

        if (filtered.length > 0) {
            renderRecommendations(filtered);
        } else if (!nextPageToken) {
            document.getElementById('recommendations').insertAdjacentHTML('beforeend', `<p>No more videos.</p>`);
        }
    } catch (err) {
        console.error("Error loading more videos:", err);
    }
    isFetching = false;
}

// 🧱 Render recommended videos
function renderRecommendations(videos) {
    const container = document.getElementById('recommendations');
    container.innerHTML += videos.map(video => `
        <div class="video" onclick="openPlayerPage('${video.id}')">
            <img src="${video.snippet.thumbnails.medium.url}" />
            <p>${video.snippet.title}</p>
        </div>
    `).join('');
}

// 🔁 Navigate to new video
function openPlayerPage(newVideoId) {
    window.location.href = `player.html?videoId=${newVideoId}`;
}

// 🔁 Infinite scroll logic
window.addEventListener('scroll', () => {
    const scrollBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 100;
    if (scrollBottom && nextPageToken && !isFetching) {
        loadMoreRecommendations();
    }
});

// dark mode toggle
// Load dark mode from localStorage
if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-mode');
}

// Toggle dark mode
const toggleBtn = document.getElementById('dark-mode-toggle');

// Load theme on page load
if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-mode');
    toggleBtn.textContent = "☀️ Light Mode";
}

// Toggle dark/light mode
toggleBtn.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');

    // Update toggle label
    toggleBtn.textContent = isDark ? "☀️ Light Mode" : "🌙 Dark Mode";
});
