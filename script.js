class RadioPlayer {
    constructor() {
        this.audio = document.getElementById('audioPlayer');
        this.playPauseBtn = document.getElementById('playPauseBtn');
        this.playOverlay = document.getElementById('playOverlay');
        this.volumeSlider = document.getElementById('volumeSlider');
        this.statusDot = document.getElementById('statusDot');
        this.trackTitle = document.getElementById('trackTitle');
        this.artistName = document.getElementById('artistName');
        this.albumCover = document.getElementById('albumCover');
        
        this.isPlaying = false;
        this.isLoading = false;
        this.trackUpdateInterval = null;
        this.lastTrackTitle = '';
        this.lastArtistName = '';
        this.lastCoverUrl = '';
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.updateVolume();
        this.startTrackInfoUpdate();
        this.setupAudioSource();
        
        // Обработка сообщений от родительского окна
        window.addEventListener('message', (event) => {
            try {
                if (event.data.action === 'play') {
                    this.play();
                } else if (event.data.action === 'pause') {
                    this.pause();
                } else if (event.data.action === 'setVolume') {
                    this.setVolume(event.data.volume);
                }
            } catch (error) {
                console.log('Message handling error:', error);
            }
        });
    }
    
    setupEventListeners() {
        this.playPauseBtn.addEventListener('click', () => {
            if (this.isPlaying) {
                this.pause();
            } else {
                this.play();
            }
        });
        
        this.playOverlay.addEventListener('click', () => {
            if (this.isPlaying) {
                this.pause();
            } else {
                this.play();
            }
        });
        
        this.volumeSlider.addEventListener('input', () => {
            this.updateVolume();
        });
        
        this.audio.addEventListener('loadstart', () => {
            this.setStatus('loading');
        });
        
        this.audio.addEventListener('canplay', () => {
            this.setStatus('ready');
        });
        
        this.audio.addEventListener('play', () => {
            this.isPlaying = true;
            this.updatePlayPauseButton();
            this.setStatus('playing');
        });
        
        this.audio.addEventListener('pause', () => {
            this.isPlaying = false;
            this.updatePlayPauseButton();
            this.setStatus('paused');
        });
        
        this.audio.addEventListener('error', (e) => {
            console.error('Audio error:', e);
            this.setStatus('error');
        });
        
        this.audio.addEventListener('ended', () => {
            this.isPlaying = false;
            this.updatePlayPauseButton();
            this.setStatus('ready');
        });
    }
    
    async play() {
        try {
            if (this.audio.paused) {
                await this.audio.play();
                this.isPlaying = true;
                this.updatePlayPauseButton();
                this.setStatus('playing');
            }
        } catch (error) {
            console.error('Play error:', error);
            this.setStatus('error');
        }
    }
    
    pause() {
        this.audio.pause();
        this.isPlaying = false;
        this.updatePlayPauseButton();
        this.setStatus('paused');
    }
    
    updateVolume() {
        const volume = this.volumeSlider.value / 100;
        this.audio.volume = volume;
    }
    
    setVolume(volume) {
        this.volumeSlider.value = volume * 100;
        this.updateVolume();
    }
    
    updatePlayPauseButton() {
        const svg = this.playPauseBtn.querySelector('svg path');
        if (this.isPlaying) {
            svg.setAttribute('d', 'M6 4h4v16H6V4zm8 0h4v16h-4V4z');
        } else {
            svg.setAttribute('d', 'M8 5v14l11-7z');
        }
    }
    
    setStatus(type) {
        this.statusDot.className = `status-dot ${type}`;
    }
    
    setupAudioSource() {
        // Если мы на HTTPS, пытаемся использовать HTTPS источник
        if (window.location.protocol === 'https:') {
            this.audio.src = 'https://193.168.3.158:8000/online';
            
            // Если HTTPS не работает, переключаемся на HTTP
            this.audio.addEventListener('error', () => {
                console.log('HTTPS audio failed, trying HTTP fallback');
                this.audio.src = 'http://193.168.3.158:8000/online';
                
                // Если и HTTP не работает, показываем сообщение
                this.audio.addEventListener('error', () => {
                    console.log('All audio sources failed');
                    this.setStatus('error');
                }, { once: true });
            }, { once: true });
        } else {
            // На HTTP используем HTTP источник
            this.audio.src = 'http://193.168.3.158:8000/online';
        }
    }
    
    async startTrackInfoUpdate() {
        // Обновляем информацию о треке каждые 10 секунд
        this.updateTrackInfo();
        this.trackUpdateInterval = setInterval(() => {
            this.updateTrackInfo();
        }, 10000);
    }
    
    async updateTrackInfo() {
        try {
            // Получаем информацию с Icecast сервера
            const response = await fetch('http://193.168.3.158:8000/status-json.xsl', {
                method: 'GET',
                mode: 'cors',
                cache: 'no-cache'
            });
            
            if (response.ok) {
                const data = await response.json();
                
                // Ищем информацию о нашем потоке
                if (data.icestats && data.icestats.source) {
                    const source = data.icestats.source;
                    let currentTrack = '';
                    
                    // Ищем текущий трек в разных форматах
                    if (source.title) {
                        currentTrack = source.title;
                    } else if (source.yp_currently_playing) {
                        currentTrack = source.yp_currently_playing;
                    } else if (source.server_description) {
                        currentTrack = source.server_description;
                    }
                    
                    if (currentTrack && currentTrack !== this.lastTrackTitle) {
                        const trackInfo = this.parseTrackInfo(currentTrack);
                        
                        this.trackTitle.textContent = trackInfo.title;
                        this.artistName.textContent = trackInfo.artist;
                        
                        this.lastTrackTitle = trackInfo.title;
                        this.lastArtistName = trackInfo.artist;
                        
                        // Пытаемся найти обложку для трека
                        this.searchCoverForTrack(trackInfo.artist, trackInfo.title);
                    }
                }
            } else {
                // Если Icecast недоступен, пробуем альтернативный метод
                await this.updateTrackInfoAlternative();
            }
        } catch (error) {
            console.log('Icecast track info error:', error);
            // Пробуем альтернативный метод
            await this.updateTrackInfoAlternative();
        }
    }
    
    
    async updateTrackInfoAlternative() {
        try {
            // Альтернативный метод - парсим HTML страницу статуса
            const response = await fetch('http://193.168.3.158:8000/', {
                method: 'GET',
                mode: 'cors',
                cache: 'no-cache'
            });
            
            if (response.ok) {
                const htmlText = await response.text();
                const trackData = this.parseTrackDataFromHTML(htmlText);
                
                if (trackData.title && trackData.title !== this.lastTrackTitle) {
                    this.trackTitle.textContent = trackData.title;
                    this.artistName.textContent = trackData.artist;
                    
                    this.lastTrackTitle = trackData.title;
                    this.lastArtistName = trackData.artist;
                    
                    // Пытаемся найти обложку для трека
                    this.searchCoverForTrack(trackData.artist, trackData.title);
                }
            } else {
                this.setDefaultTrackInfo();
            }
        } catch (error) {
            console.log('Alternative track info error:', error);
            this.setDefaultTrackInfo();
        }
    }
    
    parseTrackDataFromHTML(htmlText) {
        const trackData = {
            title: '',
            artist: '',
            cover: ''
        };
        
        try {
            // Ищем "Currently playing:" в HTML
            const currentlyPlayingMatch = htmlText.match(/Currently playing:\s*([^<]+)/i);
            if (currentlyPlayingMatch) {
                const trackString = currentlyPlayingMatch[1].trim();
                const parsed = this.parseTrackInfo(trackString);
                trackData.title = parsed.title;
                trackData.artist = parsed.artist;
            }
        } catch (error) {
            console.log('HTML parsing error:', error);
        }
        
        return trackData;
    }
    
    parseTrackInfo(trackString) {
        // Пытаемся разделить строку на исполнителя и название трека
        const separators = [' - ', ' – ', ' — ', ': ', ' / ', ' | '];
        let artist = 'Radio Nostalgie';
        let title = 'Музыка проверенная временем';
        
        for (let sep of separators) {
            if (trackString.includes(sep)) {
                const parts = trackString.split(sep);
                if (parts.length >= 2) {
                    artist = parts[0].trim();
                    title = parts[1].trim();
                    break;
                }
            }
        }
        
        // Если разделитель не найден, используем всю строку как название
        if (artist === 'Radio Nostalgie' && title === 'Музыка проверенная временем') {
            title = trackString;
        }
        
        return { artist, title };
    }
    
    async searchCoverForTrack(artist, title) {
        try {
            // Пытаемся найти обложку через iTunes API
            const itunesResponse = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(artist + ' ' + title)}&media=music&limit=1`);
            
            if (itunesResponse.ok) {
                const data = await itunesResponse.json();
                if (data.results && data.results.length > 0) {
                    const track = data.results[0];
                    if (track.artworkUrl100) {
                        // Используем обложку высокого качества
                        const coverUrl = track.artworkUrl100.replace('100x100', '300x300');
                        this.albumCover.src = coverUrl;
                        this.lastCoverUrl = coverUrl;
                        console.log('Cover found via iTunes:', coverUrl);
                        return;
                    }
                }
            }
        } catch (error) {
            console.log('iTunes API error:', error);
        }
        
        try {
            // Пытаемся найти обложку через Last.fm API (без API ключа)
            const lastfmResponse = await fetch(`https://ws.audioscrobbler.com/2.0/?method=track.getInfo&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(title)}&format=json`);
            
            if (lastfmResponse.ok) {
                const data = await lastfmResponse.json();
                if (data.track && data.track.album && data.track.album.image) {
                    const images = data.track.album.image;
                    // Берем изображение среднего размера
                    const coverUrl = images.find(img => img.size === 'medium')?.['#text'] || images[0]?.['#text'];
                    if (coverUrl) {
                        this.albumCover.src = coverUrl;
                        this.lastCoverUrl = coverUrl;
                        console.log('Cover found via Last.fm:', coverUrl);
                        return;
                    }
                }
            }
        } catch (error) {
            console.log('Last.fm API error:', error);
        }
        
        try {
            // Пытаемся найти обложку через Spotify API (без токена)
            const spotifyResponse = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(artist + ' ' + title)}&type=track&limit=1`);
            
            if (spotifyResponse.ok) {
                const data = await spotifyResponse.json();
                if (data.tracks && data.tracks.items && data.tracks.items.length > 0) {
                    const track = data.tracks.items[0];
                    if (track.album && track.album.images && track.album.images.length > 0) {
                        const coverUrl = track.album.images[0].url;
                        this.albumCover.src = coverUrl;
                        this.lastCoverUrl = coverUrl;
                        console.log('Cover found via Spotify:', coverUrl);
                        return;
                    }
                }
            }
        } catch (error) {
            console.log('Spotify API error:', error);
        }
        
        // Если не удалось найти обложку, используем стандартную
        this.albumCover.src = this.getDefaultCover();
    }
    
    setDefaultTrackInfo() {
        this.trackTitle.textContent = 'Radio Nostalgie';
        this.artistName.textContent = 'Музыка проверенная временем';
        this.albumCover.src = this.getDefaultCover();
    }
    
    getDefaultCover() {
        return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjZjBmMGYwIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iMTAwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTYiIGZpbGw9IiM2NjYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5SYWRpbyBOb3N0YWxnaWU8L3RleHQ+Cjwvc3ZnPgo=';
    }
}

// Инициализация плеера
document.addEventListener('DOMContentLoaded', () => {
    try {
        new RadioPlayer();
    } catch (error) {
        console.error('Player initialization error:', error);
    }
});