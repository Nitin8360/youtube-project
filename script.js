const API_KEY = 'AIzaSyB2MEJPXj44OhXvOqUCPZDQFzBS8hEryaA';

let nextPageToken = '';
let currentQuery = '';
let isFetching = false;
let isSearchMode = false;

// 🌍 Load on page ready
window.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    // Dark Mode Init
    initializeDarkMode();
    
    // Sidebar toggle for mobile
    initializeSidebarToggle();
    
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

    // Initialize search functionality
    initializeSearch();

    // Load initial content
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get('search');
    const savedQuery = localStorage.getItem('lastSearch');
    const input = document.getElementById('search-input');
    
    if (searchQuery) {
        // Search from URL parameter (e.g., from player page)
        input.value = searchQuery;
        currentQuery = searchQuery;
        isSearchMode = true;
        localStorage.setItem('lastSearch', searchQuery);
        searchVideos(searchQuery);
    } else if (savedQuery) {
        // Search from saved query
        input.value = savedQuery;
        currentQuery = savedQuery;
        isSearchMode = true;
        searchVideos(savedQuery);
    } else {
        // Load trending videos
        fetchTrendingVideos();
    }

    // Initialize infinite scroll
    initializeInfiniteScroll();
}

function initializeDarkMode() {
    const toggleBtn = document.getElementById('dark-mode-toggle');
    const darkModeIcon = toggleBtn.querySelector('.material-icons');
    
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
        darkModeIcon.textContent = "light_mode";
    }

    toggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        darkModeIcon.textContent = isDark ? "light_mode" : "dark_mode";
    });
}

function initializeSidebarToggle() {
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');
    
    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });
    }
}

function initializeSearch() {
    const searchBtn = document.getElementById('search-btn');
    const input = document.getElementById('search-input');
    const micBtn = document.querySelector('.mic-btn');

    // 🔍 Search by button
    searchBtn.addEventListener('click', () => {
        performSearch();
    });

    // 🔍 Search by Enter key
    input.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            performSearch();
        }
    });

    // 🎤 Microphone search
    if (micBtn) {
        micBtn.addEventListener('click', () => {
            startVoiceSearch();
        });
    }
}

function performSearch() {
    const input = document.getElementById('search-input');
    const query = input.value.trim();
    if (query !== "") {
        localStorage.setItem('lastSearch', query);
        currentQuery = query;
        isSearchMode = true;
        nextPageToken = '';
        searchVideos(query);
    }
}

function initializeInfiniteScroll() {
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
}

// 🔍 Search videos
async function searchVideos(query, pageToken = '') {
    isFetching = true;
    
    // Show loading only for first page
    if (pageToken === '') {
        showLoadingMessage(`Searching for "${query}"...`);
    }
    
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=20&q=${query}&key=${API_KEY}&pageToken=${pageToken}&videoEmbeddable=true&videoSyndicated=true`;

    try {
        const searchResponse = await fetch(searchUrl);
        const searchData = await searchResponse.json();
        
        if (searchData.error) {
            console.error("Search API error:", searchData.error);
            showErrorMessage("Search failed. Please try again.");
            isFetching = false;
            return;
        }
        
        nextPageToken = searchData.nextPageToken || '';
        const videoIds = searchData.items.map(item => item.id.videoId).filter(Boolean);
        
        if (videoIds.length > 0) {
            const videoIdMap = Object.fromEntries(searchData.items.map(item => [item.id.videoId, item]));
            await fetchEmbeddableVideos(videoIds, pageToken === '', videoIdMap);
        } else {
            if (pageToken === '') {
                showErrorMessage("No videos found for this search. Try different keywords.");
            }
        }
    } catch (error) {
        console.error("Search error:", error);
        showErrorMessage("Failed to search videos. Please check your internet connection and try again.");
    }
    isFetching = false;
}

// 📈 Trending videos
async function fetchTrendingVideos(pageToken = '') {
    isFetching = true;
    isSearchMode = false;
    localStorage.removeItem('lastSearch');
    
    // Show loading only for first page
    if (pageToken === '') {
        showLoadingMessage("Loading trending videos...");
    }
    
    const trendingUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,status,statistics&chart=mostPopular&regionCode=US&maxResults=20&key=${API_KEY}&pageToken=${pageToken}`;

    try {
        const response = await fetch(trendingUrl);
        const data = await response.json();
        
        if (data.error) {
            console.error("Trending API error:", data.error);
            showErrorMessage("Failed to load trending videos. Please try again.");
            isFetching = false;
            return;
        }
        
        nextPageToken = data.nextPageToken || '';
        const videoIds = data.items.map(video => video.id);
        const videoMap = Object.fromEntries(data.items.map(video => [video.id, video]));
        await fetchEmbeddableVideos(videoIds, pageToken === '', videoMap);
    } catch (error) {
        console.error("Trending error:", error);
        showErrorMessage("Failed to load trending videos. Please check your internet connection and try again.");
    }
    isFetching = false;
}

// 🎞️ Show Embeddable Videos
async function fetchEmbeddableVideos(videoIds, isFirstPage = false, originalData = {}) {
    const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,status,statistics&id=${videoIds.join(',')}&key=${API_KEY}`;

    try {
        const response = await fetch(detailsUrl);
        const data = await response.json();
        
        if (data.error) {
            console.error("Video details API error:", data.error);
            showErrorMessage("Failed to load video details. Please try again.");
            return;
        }
        
        // Enhanced filtering for available videos
        const embeddableVideos = data.items.filter(video => {
            const status = video.status;
            const snippet = video.snippet;
            
            return (
                status.embeddable === true &&
                status.privacyStatus === "public" &&
                status.uploadStatus === "processed" &&
                !status.madeForKids && // Avoid kids videos that might have restrictions
                snippet.liveBroadcastContent !== "live" && // Skip live videos
                snippet.liveBroadcastContent !== "upcoming" // Skip scheduled videos
            );
        });

        const container = document.getElementById('video-container');
        if (isFirstPage) container.innerHTML = "";

        if (embeddableVideos.length === 0 && isFirstPage) {
            showErrorMessage("No available videos found. Please try a different search or refresh the page.");
            return;
        }

        embeddableVideos.forEach(video => {
            const videoCard = createVideoCard(video);
            container.appendChild(videoCard);
        });

        // If we got very few results, try to load more
        if (embeddableVideos.length < 6 && nextPageToken && !isFetching) {
            setTimeout(() => {
                if (isSearchMode) {
                    searchVideos(currentQuery, nextPageToken);
                } else {
                    fetchTrendingVideos(nextPageToken);
                }
            }, 1000);
        }
    } catch (error) {
        console.error("Embed error:", error);
        showErrorMessage("Failed to load videos. Please check your internet connection and try again.");
    }
}

function createVideoCard(video) {
    const videoCard = document.createElement('div');
    videoCard.className = 'video';
    videoCard.setAttribute('onclick', `openPlayerPage('${video.id}')`);

    // Format view count
    const viewCount = video.statistics?.viewCount ? formatViewCount(video.statistics.viewCount) : 'No views';
    
    // Format published date
    const publishedDate = formatPublishedDate(video.snippet.publishedAt);
    
    // Get channel name
    const channelName = video.snippet.channelTitle || 'Unknown Channel';
    
    // Truncate title if too long
    const title = video.snippet.title.length > 60 ? 
        video.snippet.title.substring(0, 60) + '...' : 
        video.snippet.title;

    videoCard.innerHTML = `
        <div class="video-thumbnail">
            <img src="${video.snippet.thumbnails.medium.url}" alt="Video Thumbnail">
            <div class="video-duration">${getRandomDuration()}</div>
        </div>
        <div class="video-info">
            <div class="video-title">${title}</div>
            <div class="video-channel">${channelName}</div>
            <div class="video-metadata">${viewCount} • ${publishedDate}</div>
        </div>
    `;
    
    return videoCard;
}

function formatViewCount(count) {
    const num = parseInt(count);
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M views';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K views';
    }
    return num + ' views';
}

function formatPublishedDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
}

function getRandomDuration() {
    const minutes = Math.floor(Math.random() * 20) + 1;
    const seconds = Math.floor(Math.random() * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function showErrorMessage(message) {
    const container = document.getElementById('video-container');
    container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #666;">
            <div style="margin-bottom: 16px;">
                <span class="material-icons" style="font-size: 48px; color: #ccc;">error_outline</span>
            </div>
            <p style="font-size: 16px; margin-bottom: 20px;">${message}</p>
            <button onclick="location.reload()" style="padding: 10px 20px; background: #ff0000; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">
                <span class="material-icons" style="vertical-align: middle; margin-right: 8px; font-size: 18px;">refresh</span>
                Retry
            </button>
        </div>
    `;
}

// Add loading indicator
function showLoadingMessage(message = "Loading videos...") {
    const container = document.getElementById('video-container');
    container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #666;">
            <div style="margin-bottom: 16px;">
                <div style="border: 4px solid #f3f3f3; border-top: 4px solid #ff0000; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto;"></div>
            </div>
            <p style="font-size: 16px;">${message}</p>
        </div>
        <style>
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    `;
}

// ▶️ Inline player
function playVideo(videoId) {
    const playerFrame = document.getElementById('player-frame');
    const playerSection = document.getElementById('video-player-section');
    playerFrame.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
    playerSection.style.display = 'block';
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
}

// ❌ Close player
function closePlayer() {
    const playerFrame = document.getElementById('player-frame');
    const playerSection = document.getElementById('video-player-section');
    playerFrame.src = '';
    playerSection.style.display = 'none';
    document.body.style.overflow = 'auto'; // Restore scrolling
}

// 📺 Redirect to player.html with availability check
function openPlayerPage(videoId) {
    // First check if the video is actually available
    checkVideoAvailability(videoId).then(isAvailable => {
        if (isAvailable) {
            window.location.href = `player.html?videoId=${videoId}`;
        } else {
            console.log(`Video ${videoId} is not available, skipping...`);
            // Show a brief message and don't navigate
            showTemporaryMessage("This video is not available. Please try another video.");
        }
    });
}

// Check if a video is actually available and embeddable
async function checkVideoAvailability(videoId) {
    try {
        const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=status&id=${videoId}&key=${API_KEY}`);
        const data = await response.json();
        
        if (data.items && data.items.length > 0) {
            const status = data.items[0].status;
            return status.embeddable === true && 
                   status.privacyStatus === "public" && 
                   status.uploadStatus === "processed";
        }
        return false;
    } catch (error) {
        console.error("Error checking video availability:", error);
        return true; // Default to true if check fails, let YouTube handle the error
    }
}

// Voice search functionality
function startVoiceSearch() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        showTemporaryMessage("Voice search is not supported in this browser. Please try Chrome or Edge.");
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    const micBtn = document.querySelector('.mic-btn');
    const micIcon = micBtn.querySelector('.material-icons');
    const originalIcon = micIcon.textContent;
    
    // Visual feedback during recording
    micIcon.textContent = 'mic';
    micBtn.style.backgroundColor = '#ff0000';
    micBtn.style.color = 'white';
    
    // Add pulsing animation
    micBtn.style.animation = 'pulse 1s infinite';
    
    recognition.onstart = function() {
        console.log('Voice search started');
        showTemporaryMessage("Listening... Speak now!", 'info');
    };

    recognition.onresult = function(event) {
        const transcript = event.results[0][0].transcript;
        console.log('Voice search result:', transcript);
        
        const searchInput = document.getElementById('search-input');
        searchInput.value = transcript;
        
        // Automatically perform search
        performSearch();
        
        showTemporaryMessage(`Searching for: "${transcript}"`, 'success');
    };

    recognition.onerror = function(event) {
        console.error('Voice search error:', event.error);
        let errorMessage = "Voice search failed. ";
        
        switch(event.error) {
            case 'no-speech':
                errorMessage += "No speech detected. Please try again.";
                break;
            case 'audio-capture':
                errorMessage += "Microphone not available.";
                break;
            case 'not-allowed':
                errorMessage += "Microphone access denied. Please allow microphone access.";
                break;
            default:
                errorMessage += "Please try again.";
        }
        
        showTemporaryMessage(errorMessage, 'error');
    };

    recognition.onend = function() {
        console.log('Voice search ended');
        
        // Reset visual feedback
        micIcon.textContent = originalIcon;
        micBtn.style.backgroundColor = '';
        micBtn.style.color = '';
        micBtn.style.animation = '';
    };

    try {
        recognition.start();
    } catch (error) {
        console.error('Failed to start voice recognition:', error);
        showTemporaryMessage("Failed to start voice search. Please try again.", 'error');
        
        // Reset visual feedback
        micIcon.textContent = originalIcon;
        micBtn.style.backgroundColor = '';
        micBtn.style.color = '';
        micBtn.style.animation = '';
    }
}

// Enhanced temporary message function with types
function showTemporaryMessage(message, type = 'info') {
    const messageDiv = document.createElement('div');
    
    let backgroundColor;
    let iconName;
    
    switch(type) {
        case 'success':
            backgroundColor = '#4caf50';
            iconName = 'check_circle';
            break;
        case 'error':
            backgroundColor = '#ff0000';
            iconName = 'error';
            break;
        case 'info':
        default:
            backgroundColor = '#2196f3';
            iconName = 'info';
            break;
    }
    
    messageDiv.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: ${backgroundColor};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 10000;
        font-size: 14px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        display: flex;
        align-items: center;
        gap: 8px;
        max-width: 300px;
        animation: slideIn 0.3s ease-out;
    `;
    
    messageDiv.innerHTML = `
        <span class="material-icons" style="font-size: 18px;">${iconName}</span>
        <span>${message}</span>
    `;
    
    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.style.animation = 'slideOut 0.3s ease-out forwards';
            messageDiv.addEventListener('animationend', () => {
                if (messageDiv.parentNode) {
                    document.body.removeChild(messageDiv);
                }
            });
        }
    }, type === 'error' ? 4000 : 2500);
    
    // Add slideOut animation
    style.textContent += `
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
}

// Handle sidebar item clicks
document.addEventListener('DOMContentLoaded', () => {
    const sidebarItems = document.querySelectorAll('.sidebar-item');
    sidebarItems.forEach(item => {
        item.addEventListener('click', () => {
            // Remove active class from all items
            sidebarItems.forEach(i => i.classList.remove('active'));
            // Add active class to clicked item
            item.classList.add('active');
            
            const text = item.querySelector('.sidebar-text')?.textContent;
            if (text === 'Home') {
                document.getElementById('search-input').value = '';
                isSearchMode = false;
                currentQuery = '';
                fetchTrendingVideos();
            }
        });
    });
});
