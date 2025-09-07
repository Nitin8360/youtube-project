const API_KEY = 'AIzaSyB2MEJPXj44OhXvOqUCPZDQFzBS8hEryaA';
const urlParams = new URLSearchParams(window.location.search);
const videoId = urlParams.get('videoId');

let nextPageToken = '';
let categoryId = '';
let isFetching = false;
let currentVideoData = null;
let fallbackCategories = ['10', '24', '1', '2', '23']; // Music, Entertainment, Film, Autos, Comedy
let currentCategoryIndex = 0;
let relatedVideosLoaded = false;
let currentVideoTags = [];
let currentChannelId = '';

// Initialize the player
window.addEventListener('DOMContentLoaded', () => {
    initializePlayer();
});

function initializePlayer() {
    // First check if the current video is available
    if (!videoId) {
        showErrorMessage("No video ID provided. Please select a video to watch.");
        return;
    }
    
    // Check video availability before setting up player
    checkVideoAvailability(videoId).then(isAvailable => {
        if (isAvailable) {
            // Set player
            document.getElementById('main-player').src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
            
            // Initialize dark mode
            initializeDarkMode();
            
            // Initialize search functionality
            initializeSearch();
            
            // Fetch video details and recommendations
            fetchVideoDetailsAndRecommend();
            
            // Initialize infinite scroll for recommendations
            initializeInfiniteScroll();
        } else {
            // Video is not available, show error and redirect to home
            showErrorMessage("This video is not available. You will be redirected to the home page.");
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 3000);
        }
    });
}

// Initialize search functionality
function initializeSearch() {
    const searchBtn = document.getElementById('search-btn');
    const input = document.getElementById('search-input');
    const micBtn = document.getElementById('mic-btn');

    if (searchBtn && input) {
        // 🔍 Search by button
        searchBtn.addEventListener('click', () => {
            performPlayerSearch();
        });

        // 🔍 Search by Enter key
        input.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                performPlayerSearch();
            }
        });
    }

    // 🎤 Microphone search
    if (micBtn) {
        micBtn.addEventListener('click', () => {
            startVoiceSearch();
        });
    }
}

// Perform search from player page
function performPlayerSearch() {
    const input = document.getElementById('search-input');
    const query = input.value.trim();
    if (query !== "") {
        // Navigate to home page with search query
        window.location.href = `index.html?search=${encodeURIComponent(query)}`;
    }
}

function initializeDarkMode() {
    const toggleBtn = document.getElementById('dark-mode-toggle');
    const darkModeIcon = toggleBtn.querySelector('.material-icons');
    
    // Load theme on page load
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
        darkModeIcon.textContent = "light_mode";
    }

    // Toggle dark/light mode
    toggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        darkModeIcon.textContent = isDark ? "light_mode" : "dark_mode";
    });
}

function initializeInfiniteScroll() {
    // Infinite scroll logic
    window.addEventListener('scroll', () => {
        const scrollBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 100;
        if (scrollBottom && nextPageToken && !isFetching) {
            // Only load more category-based recommendations if we've already loaded related videos
            if (relatedVideosLoaded) {
                loadMoreRecommendations();
            }
        }
    });
}

// Get current video's details and load recommendations
async function fetchVideoDetailsAndRecommend() {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoId}&key=${API_KEY}`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        
        if (data.error) {
            console.error("Video details API error:", data.error);
            showErrorMessage("Failed to load video details. Please try again.");
            return;
        }
        
        const currentVideo = data.items[0];
        
        if (currentVideo) {
            currentVideoData = currentVideo;
            categoryId = currentVideo.snippet.categoryId;
            currentChannelId = currentVideo.snippet.channelId;
            currentVideoTags = currentVideo.snippet.tags || [];
            
            updateVideoDetails(currentVideo);
            
            // Load related videos first, then fallback to category-based if needed
            await loadRelatedVideos();
        } else {
            showErrorMessage("Video not found. It may have been removed or made private.");
        }
    } catch (err) {
        console.error("Failed to get video details:", err);
        showErrorMessage("Failed to load video details. Please check your internet connection and try again.");
    }
}

function updateVideoDetails(video) {
    // Update video title
    document.getElementById('video-title').textContent = video.snippet.title;
    
    // Update video stats
    const views = video.statistics?.viewCount ? formatViewCount(video.statistics.viewCount) : 'No views';
    const publishedDate = formatPublishedDate(video.snippet.publishedAt);
    document.getElementById('video-views').textContent = views;
    document.getElementById('video-date').textContent = publishedDate;
    
    // Update channel info
    document.getElementById('channel-name').textContent = video.snippet.channelTitle || 'Unknown Channel';
    document.getElementById('channel-subscribers').textContent = 'Loading subscribers...';
    
    // Update description
    const description = video.snippet.description || 'No description available.';
    document.getElementById('video-description').textContent = description.length > 300 ? 
        description.substring(0, 300) + '...' : description;
    
    // Update page title
    document.title = video.snippet.title + ' - YouTube';
    
    // Fetch channel details for subscriber count
    fetchChannelDetails(video.snippet.channelId);
}

async function fetchChannelDetails(channelId) {
    const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=${channelId}&key=${API_KEY}`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        const channel = data.items[0];
        
        if (channel) {
            const subscriberCount = channel.statistics?.subscriberCount ? 
                formatSubscriberCount(channel.statistics.subscriberCount) : 'No subscribers';
            document.getElementById('channel-subscribers').textContent = subscriberCount;
            
            // Update channel avatar if available
            if (channel.snippet.thumbnails?.default?.url) {
                document.getElementById('channel-avatar').src = channel.snippet.thumbnails.default.url;
            }
        }
    } catch (err) {
        console.error("Failed to get channel details:", err);
    }
}

// Load videos related to the current video
async function loadRelatedVideos() {
    if (isFetching) return;
    isFetching = true;
    relatedVideosLoaded = true;

    console.log('Loading related videos for:', currentVideoData?.snippet?.title);
    console.log('Video tags:', currentVideoTags);
    console.log('Channel ID:', currentChannelId);
    console.log('Category ID:', categoryId);

    try {
        // Strategy 1: Search by video tags (if available)
        if (currentVideoTags.length > 0) {
            console.log('Trying tag-based search...');
            const tagBasedVideos = await searchByTags();
            if (tagBasedVideos.length > 0) {
                console.log(`Found ${tagBasedVideos.length} tag-based videos`);
                updateRecommendationsTitle('related');
                renderRecommendations(tagBasedVideos);
                isFetching = false;
                return;
            }
        }

        // Strategy 2: Search by video title keywords
        console.log('Trying title-based search...');
        const titleBasedVideos = await searchByTitle();
        if (titleBasedVideos.length > 0) {
            console.log(`Found ${titleBasedVideos.length} title-based videos`);
            updateRecommendationsTitle('related');
            renderRecommendations(titleBasedVideos);
            isFetching = false;
            return;
        }

        // Strategy 3: Get videos from the same channel
        console.log('Trying channel-based search...');
        const channelVideos = await getChannelVideos();
        if (channelVideos.length > 0) {
            console.log(`Found ${channelVideos.length} channel videos`);
            updateRecommendationsTitle('channel');
            renderRecommendations(channelVideos);
            isFetching = false;
            return;
        }

        // Strategy 4: Fallback to category-based recommendations
        console.log('Falling back to category-based recommendations...');
        updateRecommendationsTitle('category');
        await loadMoreRecommendations();
        
    } catch (err) {
        console.error("Error loading related videos:", err);
        // Fallback to category-based recommendations
        updateRecommendationsTitle('category');
        await loadMoreRecommendations();
    }
    
    isFetching = false;
}

// Search videos by tags
async function searchByTags() {
    const searchTags = currentVideoTags.slice(0, 3).join(' '); // Use first 3 tags
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=10&q=${encodeURIComponent(searchTags)}&key=${API_KEY}&videoEmbeddable=true&videoSyndicated=true&order=relevance`;

    try {
        const response = await fetch(searchUrl);
        const data = await response.json();
        
        if (data.error || !data.items) {
            return [];
        }

        const videoIds = data.items
            .map(item => item.id.videoId)
            .filter(id => id && id !== videoId);

        return await getFilteredVideos(videoIds);
    } catch (err) {
        console.error("Error searching by tags:", err);
        return [];
    }
}

// Search videos by title keywords
async function searchByTitle() {
    if (!currentVideoData || !currentVideoData.snippet.title) {
        return [];
    }

    // Extract meaningful keywords from title (remove common words)
    const title = currentVideoData.snippet.title;
    const keywords = extractKeywords(title);
    const searchQuery = keywords.slice(0, 3).join(' '); // Use top 3 keywords

    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=10&q=${encodeURIComponent(searchQuery)}&key=${API_KEY}&videoEmbeddable=true&videoSyndicated=true&order=relevance`;

    try {
        const response = await fetch(searchUrl);
        const data = await response.json();
        
        if (data.error || !data.items) {
            return [];
        }

        const videoIds = data.items
            .map(item => item.id.videoId)
            .filter(id => id && id !== videoId);

        return await getFilteredVideos(videoIds);
    } catch (err) {
        console.error("Error searching by title:", err);
        return [];
    }
}

// Get videos from the same channel
async function getChannelVideos() {
    if (!currentChannelId) {
        return [];
    }

    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=8&channelId=${currentChannelId}&key=${API_KEY}&videoEmbeddable=true&videoSyndicated=true&order=relevance`;

    try {
        const response = await fetch(searchUrl);
        const data = await response.json();
        
        if (data.error || !data.items) {
            return [];
        }

        const videoIds = data.items
            .map(item => item.id.videoId)
            .filter(id => id && id !== videoId);

        return await getFilteredVideos(videoIds);
    } catch (err) {
        console.error("Error getting channel videos:", err);
        return [];
    }
}

// Extract keywords from video title
function extractKeywords(title) {
    // Common words to filter out
    const stopWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'official', 'video', 'song', 'music', 'ft', 'feat', 'featuring'];
    
    return title
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ') // Remove special characters
        .split(/\s+/)
        .filter(word => word.length > 2 && !stopWords.includes(word))
        .slice(0, 5); // Get top 5 keywords
}

// Get filtered and validated videos
async function getFilteredVideos(videoIds) {
    if (videoIds.length === 0) {
        return [];
    }

    const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,status,statistics&id=${videoIds.join(',')}&key=${API_KEY}`;

    try {
        const response = await fetch(detailsUrl);
        const data = await response.json();
        
        if (data.error || !data.items) {
            return [];
        }

        return data.items.filter(video => {
            const status = video.status;
            const snippet = video.snippet;
            
            return (
                video.id !== videoId &&
                status.embeddable === true &&
                status.privacyStatus === "public" &&
                status.uploadStatus === "processed" &&
                !status.madeForKids &&
                snippet.liveBroadcastContent !== "live" &&
                snippet.liveBroadcastContent !== "upcoming"
            );
        });
    } catch (err) {
        console.error("Error getting filtered videos:", err);
        return [];
    }
}

// Load more recommendations (by category + token)
async function loadMoreRecommendations() {
    if (isFetching || !categoryId) return;
    isFetching = true;

    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,status,statistics&chart=mostPopular&regionCode=US&videoCategoryId=${categoryId}&maxResults=15&pageToken=${nextPageToken}&key=${API_KEY}`;

    try {
        const res = await fetch(url);
        const data = await res.json();
        
        if (data.error) {
            console.error("Recommendations API error:", data.error);
            showErrorMessage("Failed to load recommendations. Please try again.");
            isFetching = false;
            return;
        }
        
        nextPageToken = data.nextPageToken || '';
        
        // Enhanced filtering for available videos
        const filtered = data.items.filter(video => {
            const status = video.status;
            const snippet = video.snippet;
            
            return (
                video.id !== videoId && // Not the current video
                status.embeddable === true &&
                status.privacyStatus === "public" &&
                status.uploadStatus === "processed" &&
                !status.madeForKids && // Avoid kids videos that might have restrictions
                snippet.liveBroadcastContent !== "live" && // Skip live videos
                snippet.liveBroadcastContent !== "upcoming" // Skip scheduled videos
            );
        });

        if (filtered.length > 0) {
            renderRecommendations(filtered);
        } else if (!nextPageToken) {
            // Try fallback categories if main category doesn't have enough videos
            await loadFallbackRecommendations();
        } else {
            // Try to load more if we didn't get enough results
            setTimeout(() => {
                loadMoreRecommendations();
            }, 1000);
        }
    } catch (err) {
        console.error("Error loading more videos:", err);
        showErrorMessage("Failed to load recommendations. Please check your internet connection and try again.");
    }
    isFetching = false;
}

// Render recommended videos
function renderRecommendations(videos) {
    const container = document.getElementById('recommendations');
    
    videos.forEach(video => {
        const viewCount = video.statistics?.viewCount ? formatViewCount(video.statistics.viewCount) : 'No views';
        const publishedDate = formatPublishedDate(video.snippet.publishedAt);
        const channelName = video.snippet.channelTitle || 'Unknown Channel';
        const duration = getRandomDuration();
        
        const title = video.snippet.title.length > 50 ? 
            video.snippet.title.substring(0, 50) + '...' : 
            video.snippet.title;

        const recommendationItem = document.createElement('div');
        recommendationItem.className = 'recommendation-item';
        recommendationItem.onclick = () => openPlayerPage(video.id);
        
        recommendationItem.innerHTML = `
            <div class="recommendation-thumbnail">
                <img src="${video.snippet.thumbnails.medium.url}" alt="Video Thumbnail">
                <div class="recommendation-duration">${duration}</div>
            </div>
            <div class="recommendation-info">
                <div class="recommendation-title">${title}</div>
                <div class="recommendation-channel">${channelName}</div>
                <div class="recommendation-metadata">${viewCount} • ${publishedDate}</div>
            </div>
        `;
        
        container.appendChild(recommendationItem);
    });
}

// Update recommendations title based on content type
function updateRecommendationsTitle(type) {
    const titleElement = document.getElementById('recommendations-title');
    if (titleElement) {
        switch (type) {
            case 'related':
                titleElement.textContent = 'Related videos';
                break;
            case 'channel':
                titleElement.textContent = 'More from this channel';
                break;
            case 'category':
                titleElement.textContent = 'Recommended for you';
                break;
            default:
                titleElement.textContent = 'Up next';
        }
    }
}

// Load fallback recommendations from popular categories
async function loadFallbackRecommendations() {
    if (currentCategoryIndex >= fallbackCategories.length) {
        const container = document.getElementById('recommendations');
        container.insertAdjacentHTML('beforeend', `
            <div style="text-align: center; padding: 20px; color: #666;">
                <p>No more recommendations available.</p>
            </div>
        `);
        return;
    }

    const fallbackCategoryId = fallbackCategories[currentCategoryIndex];
    currentCategoryIndex++;

    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,status,statistics&chart=mostPopular&regionCode=US&videoCategoryId=${fallbackCategoryId}&maxResults=10&key=${API_KEY}`;

    try {
        const res = await fetch(url);
        const data = await res.json();
        
        if (data.error) {
            console.error("Fallback recommendations API error:", data.error);
            await loadFallbackRecommendations(); // Try next category
            return;
        }
        
        const filtered = data.items.filter(video => {
            const status = video.status;
            const snippet = video.snippet;
            
            return (
                video.id !== videoId &&
                status.embeddable === true &&
                status.privacyStatus === "public" &&
                status.uploadStatus === "processed" &&
                !status.madeForKids &&
                snippet.liveBroadcastContent !== "live" &&
                snippet.liveBroadcastContent !== "upcoming"
            );
        });

        if (filtered.length > 0) {
            renderRecommendations(filtered.slice(0, 6)); // Limit to 6 videos
        } else {
            await loadFallbackRecommendations(); // Try next category
        }
    } catch (err) {
        console.error("Error loading fallback videos:", err);
        await loadFallbackRecommendations(); // Try next category
    }
}

// Navigate to new video with availability check
function openPlayerPage(newVideoId) {
    // First check if the video is actually available
    checkVideoAvailability(newVideoId).then(isAvailable => {
        if (isAvailable) {
            window.location.href = `player.html?videoId=${newVideoId}`;
        } else {
            console.log(`Video ${newVideoId} is not available, skipping...`);
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
        return true; // Default to true if check fails
    }
}

// Voice search functionality
function startVoiceSearch() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        showTemporaryMessage("Voice search is not supported in this browser. Please try Chrome or Edge.", 'error');
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    const micBtn = document.getElementById('mic-btn');
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
        if (searchInput) {
            searchInput.value = transcript;
        }
        
        // Navigate to home page with search query
        showTemporaryMessage(`Searching for: "${transcript}"`, 'success');
        setTimeout(() => {
            window.location.href = `index.html?search=${encodeURIComponent(transcript)}`;
        }, 1000);
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
    
    // Add animation styles if not already present
    if (!document.getElementById('voice-search-styles')) {
        const style = document.createElement('style');
        style.id = 'voice-search-styles';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
            @keyframes pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.1); }
                100% { transform: scale(1); }
            }
        `;
        document.head.appendChild(style);
    }
    
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
}

// Utility functions
function formatViewCount(count) {
    const num = parseInt(count);
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M views';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K views';
    }
    return num + ' views';
}

function formatSubscriberCount(count) {
    const num = parseInt(count);
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M subscribers';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K subscribers';
    }
    return num + ' subscribers';
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
    const container = document.getElementById('recommendations');
    container.innerHTML = `
        <div style="text-align: center; padding: 20px; color: #666;">
            <p>${message}</p>
            <button onclick="location.reload()" style="padding: 10px 20px; background: #ff0000; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 10px;">
                Retry
            </button>
        </div>
    `;
}
