const API_KEY = 'AIzaSyB2MEJPXj44OhXvOqUCPZDQFzBS8hEryaA';

let nextPageToken = '';
let currentQuery = '';
let isFetching = false;
let isSearchMode = false;

// 🌍 Load on page ready
window.addEventListener('DOMContentLoaded', () => {
    // Dark Mode Init
    const toggleBtn = document.getElementById('dark-mode-toggle');
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
        toggleBtn.textContent = "☀️ Light Mode";
    }

    toggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        toggleBtn.textContent = isDark ? "☀️ Light Mode" : "🌙 Dark Mode";
    });

    // Logo → Home
    const logo = document.getElementById('logo');
    if (logo) {
        logo.addEventListener('click', () => {
            document.getElementById('search-input').value = '';
            isSearchMode = false;
            currentQuery = '';
            fetchTrendingVideos();
        });
    }

    const savedQuery = localStorage.getItem('lastSearch');
    const input = document.getElementById('search-input');
    if (savedQuery) {
        input.value = savedQuery;
        currentQuery = savedQuery;
        isSearchMode = true;
        searchVideos(savedQuery);
    } else {
        fetchTrendingVideos();
    }

    // 🔍 Search by button
    document.getElementById('search-btn').addEventListener('click', () => {
        const query = input.value.trim();
        if (query !== "") {
            localStorage.setItem('lastSearch', query);
            currentQuery = query;
            isSearchMode = true;
            nextPageToken = '';
            searchVideos(query);
        }
    });

    // 🔍 Search by Enter key
    input.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            document.getElementById('search-btn').click();
        }
    });
});

// 🔁 Infinite scroll
window.addEventListener('scroll', () => {
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 100 && !isFetching) {
        if (nextPageToken) {
            if (isSearchMode) {
                searchVideos(currentQuery, nextPageToken);
            } else {
                fetchTrendingVideos(nextPageToken);
            }
        }
    }
});

// 🔍 Search videos
async function searchVideos(query, pageToken = '') {
    isFetching = true;
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=10&q=${query}&key=${API_KEY}&pageToken=${pageToken}`;

    try {
        const searchResponse = await fetch(searchUrl);
        const searchData = await searchResponse.json();
        nextPageToken = searchData.nextPageToken || '';
        const videoIds = searchData.items.map(item => item.id.videoId).filter(Boolean);
        const videoIdMap = Object.fromEntries(searchData.items.map(item => [item.id.videoId, item]));
        if (videoIds.length > 0) {
            fetchEmbeddableVideos(videoIds, pageToken === '', videoIdMap);
        }
    } catch (error) {
        console.error("Search error:", error);
    }
    isFetching = false;
}

// 📈 Trending videos
async function fetchTrendingVideos(pageToken = '') {
    isFetching = true;
    isSearchMode = false;
    localStorage.removeItem('lastSearch');
    const trendingUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,status&chart=mostPopular&regionCode=IN&maxResults=10&key=${API_KEY}&pageToken=${pageToken}`;

    try {
        const response = await fetch(trendingUrl);
        const data = await response.json();
        nextPageToken = data.nextPageToken || '';
        const videoIds = data.items.map(video => video.id);
        const videoMap = Object.fromEntries(data.items.map(video => [video.id, video]));
        fetchEmbeddableVideos(videoIds, pageToken === '', videoMap);
    } catch (error) {
        console.error("Trending error:", error);
    }
    isFetching = false;
}

// 🎞️ Show Embeddable Videos
async function fetchEmbeddableVideos(videoIds, isFirstPage = false, originalData = {}) {
    const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id=${videoIds.join(',')}&key=${API_KEY}`;

    try {
        const response = await fetch(detailsUrl);
        const data = await response.json();
        const embeddableVideos = data.items.filter(video =>
            video.status.embeddable && video.status.privacyStatus === "public"
        );

        const container = document.getElementById('video-container');
        if (isFirstPage) container.innerHTML = "";

        embeddableVideos.forEach(video => {
            const videoCard = document.createElement('div');
            videoCard.className = 'video';
            videoCard.setAttribute('onclick', `openPlayerPage('${video.id}')`);

            videoCard.innerHTML = `
                <img src="${video.snippet.thumbnails.medium.url}" alt="Video Thumbnail">
                <p>${video.snippet.title}</p>
            `;
            container.appendChild(videoCard);
        });
    } catch (error) {
        console.error("Embed error:", error);
    }
}

// ▶️ Inline player (optional)
function playVideo(videoId) {
    const playerFrame = document.getElementById('player-frame');
    const playerSection = document.getElementById('video-player-section');
    playerFrame.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
    playerSection.style.display = 'block';
    playerSection.scrollIntoView({ behavior: 'smooth' });
}

// ❌ Close player
function closePlayer() {
    const playerFrame = document.getElementById('player-frame');
    const playerSection = document.getElementById('video-player-section');
    playerFrame.src = '';
    playerSection.style.display = 'none';
}

// 📺 Redirect to player.html
function openPlayerPage(videoId) {
    window.location.href = `player.html?videoId=${videoId}`;
}
