import React, { memo, useEffect, useRef, useState } from 'react';
import { Animated, Image, ImageBackground, StyleSheet, Text, TouchableOpacity, View, SafeAreaView } from 'react-native';
import { connect } from 'react-redux';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import Slider from '@react-native-community/slider';
import Slider2 from "react-native-slider";
import Moment from "moment";
import { FontAwesome5, Ionicons, AntDesign, Entypo } from "@expo/vector-icons";
import { Shadow } from 'react-native-neomorph-shadows';
import { Icon } from '../../components';
import { Header } from '../../widgets';
import { Audio } from '../../hooks';
import { DISPATCHES } from '../../constants';
import Heart from "react-animated-heart";
import { millisToMin, Storage } from '../../helpers';

const gray = "#91A1BD";


const NeuMorph = ({children,size,style}) =>{
	return(
		<View style={styles.topshadow}>
			<View style={styles.bottomshadow}>
			    <View style={[styles.inner,{width: size || 40 , height: size || 40, borderRadius: size / 2 || 40 / 2},style]}>
					{children}
		        </View>
			</View>
		</View>
	)
}

const Index = ({ song, songs, dispatch, route: { params }, navigation: { goBack } }) => {
	const stopBtnAnim = useRef(new Animated.Value(song?.soundObj?.isPlaying ? 1 : 0.3)).current;
	const [isFav, setIsFav] = useState(false);
	const [actions, setActions] = useState({
		prev: false,
		play: false,
		stop: false,
		next: false,
	});

	const verifyFav = async () => {
		const favs = await Storage.get('favourites', true);
		if (favs !== null) {
			const currentIndex = songs.findIndex((i) => i.id === song?.detail?.id);
			if (favs.includes(currentIndex)) {
				setIsFav(true);
			} else {
				setIsFav(false);
			}
		}

		dispatch({
			type: DISPATCHES.STORAGE,
			payload: {
				favourites: favs,
			},
		});
	};

	const handleFav = async () => {
		const currentIndex = songs.findIndex((i) => i.id === song?.detail?.id);
		const favs = await Storage.get('favourites', true);

		if (favs === null) {
			await Storage.store('favourites', [currentIndex], true);
		} else {
			if (favs.includes(currentIndex)) {
				const updatedFavs = favs.filter((i) => i !== currentIndex);
				await Storage.store('favourites', updatedFavs, true);
			} else {
				favs.unshift(currentIndex);
				await Storage.store('favourites', favs, true);
			}
		}

		verifyFav();
	};

	const _e = (arg = {}) => {
		setActions({
			...actions,
			...arg,
		});
	};

	const addToRecentlyPlayed = async (index) => {
		const recents = await Storage.get('recents', true);
		if (recents === null) {
			await Storage.store('recents', [index], true);
		} else {
			const filtered = recents.filter((i) => i !== index).filter((i) => recents.indexOf(i) < 9);
			filtered.unshift(index);
			await Storage.store('recents', filtered, true);
		}

		dispatch({
			type: DISPATCHES.STORAGE,
			payload: {
				recents: await Storage.get('recents', true),
			},
		});
	};

	const onPlaybackStatusUpdate = (playbackStatus) => {
		dispatch({
			type: DISPATCHES.SET_CURRENT_SONG,
			payload: {
				playbackStatus,
			},
		});

		if (playbackStatus?.didJustFinish) {
			handleNext();
		}
	};

	const configAndPlay = (shouldPlay = false) => {
		if (!song?.soundObj?.isLoaded) {
			return Audio.configAndPlay(
				song?.detail?.uri,
				shouldPlay
			)((playback, soundObj) => {
				dispatch({
					type: DISPATCHES.SET_CURRENT_SONG,
					payload: {
						playback,
						soundObj,
					},
				});

				addToRecentlyPlayed(songs.findIndex((i) => i.id === song?.detail?.id));
			})(onPlaybackStatusUpdate);
		}
	};

	const handlePlayAndPause = async () => {
		_e({ play: true });

		if (!song?.soundObj?.isLoaded) {
			configAndPlay(true);
			_e({ play: true });
		}

		if (song?.soundObj?.isLoaded && song?.soundObj?.isPlaying) {
			return Audio.pause(song?.playback)((soundObj) => {
				dispatch({
					type: DISPATCHES.SET_CURRENT_SONG,
					payload: {
						soundObj,
					},
				});

				_e({ play: false });
			});
		}

		if (song?.soundObj?.isLoaded && !song?.soundObj?.isPlaying) {
			return Audio.resume(song?.playback)((soundObj) => {
				dispatch({
					type: DISPATCHES.SET_CURRENT_SONG,
					payload: {
						soundObj,
					},
				});

				_e({ play: false });
			});
		}
	};

	const handleStop = async (after = () => {}) => {
		_e({ stop: true });

		if (song?.soundObj?.isLoaded) {
			return Audio.stop(song?.playback)(() => {
				dispatch({
					type: DISPATCHES.SET_CURRENT_SONG,
					payload: {
						soundObj: {},
					},
				});

				after();
				_e({ stop: false });
			});
		}

		after();
		_e({ stop: false });
	};

	const handlePrev = async () => {
		_e({ prev: true });

		const currentIndex = songs.findIndex((i) => i.id === song?.detail?.id);
		const prevIndex = currentIndex === 0 ? songs.length - 1 : currentIndex - 1;
		const prevSong = songs[prevIndex];

		return handleStop(() => {
			Audio.play(
				song?.playback,
				prevSong?.uri
			)((soundObj) => {
				dispatch({
					type: DISPATCHES.SET_CURRENT_SONG,
					payload: {
						soundObj,
						detail: prevSong,
					},
				});

				addToRecentlyPlayed(prevIndex);
				_e({ prev: false });
			})(onPlaybackStatusUpdate);
		});
	};

	async function handleNext() {
		_e({ next: true });

		const currentIndex = songs.findIndex((i) => i.id === song?.detail?.id);
		const nextIndex = currentIndex === songs.length - 1 ? 0 : currentIndex + 1;
		const nextSong = songs[nextIndex];

		return handleStop(() => {
			Audio.play(
				song?.playback,
				nextSong?.uri
			)((soundObj) => {
				dispatch({
					type: DISPATCHES.SET_CURRENT_SONG,
					payload: {
						soundObj,
						detail: nextSong,
					},
				});

				addToRecentlyPlayed(nextIndex);
				_e({ next: false });
			})(onPlaybackStatusUpdate);
		});
	}

	const handleSeek = (millis) => {
		return Audio.seek(
			song?.playback,
			Math.floor(millis)
		)((soundObj) => {
			dispatch({
				type: DISPATCHES.SET_CURRENT_SONG,
				payload: {
					soundObj,
				},
			});
		})(onPlaybackStatusUpdate);
	};

	useEffect(() => {
		if (song?.soundObj?.isPlaying) {
			Animated.timing(stopBtnAnim, {
				toValue: 1,
				duration: 1000,
				useNativeDriver: true,
			}).start();
		} else {
			Animated.timing(stopBtnAnim, {
				toValue: 0.3,
				duration: 1000,
				useNativeDriver: true,
			}).start();
		}
	}, [song]);

	useEffect(() => {
		(async () => {
			await Audio.init();
			configAndPlay();
		})();
	}, []);

	useEffect(() => {
		verifyFav();
	}, [song?.detail?.id]);

	useEffect(() => {
		if (params?.forcePlay && params?.song?.uri !== song?.detail?.uri) {
			handleStop(() => {
				Audio.play(
					song?.playback,
					params?.song?.uri
				)((soundObj) => {
					dispatch({
						type: DISPATCHES.SET_CURRENT_SONG,
						payload: {
							soundObj,
							detail: params?.song,
						},
					});

					addToRecentlyPlayed(params?.index);
				})(onPlaybackStatusUpdate);
			});
		}
	}, [params?.forcePlay, params?.song, params?.index]);
      const [like, setLiked] = useState(false);
	return (
		<>
			<StatusBar style="light" />
			<ImageBackground style={styles.container} source={{ uri: song?.detail?.img }} blurRadius={10} resizeMode="cover">
				<View style={[StyleSheet.absoluteFill, styles.overlay]} />
				<Header
					options={{
						left: {
							children: <NeuMorph><Icon name="chevron-left" color="#000000" /></NeuMorph>,
							onPress: goBack,
						},
						center:{
                                 children: <Text color="#000000">Now Playing</Text>,
								 onPress:goBack,
						},
						right: {
							children: <NeuMorph><AntDesign name={isFav?"heart":"hearto"} size={25} color="red" /></NeuMorph>,
							onPress: handleFav,
						},
					}}
				/>
				<View style={styles.frame}>
					<View>
						<Image style={styles.clipart} source={{ uri: song?.detail?.img }} resizeMode="cover" borderRadius={30} elevation={10} />
					</View>
					<View style={styles.details}>
						<View style={{ marginBottom: 25 }}>
							<Text style={styles.songTitle}>{song?.detail?.title}</Text>
							<Text style={styles.artistName}>{song?.detail?.author}</Text>
						</View>
						<View style={styles.tracker}>
						     <Slider
								minimumValue={0}
								maximumValue={song?.detail?.durationMillis}
								minimumTrackTintColor="#C07037"
								thumbTintColor="transparent"
								maximumTrackTintColor="transparent"
								value={song?.playbackStatus?.positionMillis || 0}
								onSlidingComplete={handleSeek}
							/> 
							
						</View>
						<View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 }}>
							<NeuMorph><Text style={styles.minMin}>{millisToMin(song?.playbackStatus?.positionMillis || 0)}</Text></NeuMorph>
							<NeuMorph><Text style={styles.maxMin}>{millisToMin(song?.detail?.durationMillis)}</Text></NeuMorph>
						</View>
					</View>
					<View style={styles.actionsContainer}>
						<TouchableOpacity onPress={handlePrev}>
							<NeuMorph size={70}><Icon name="skip-back" color="#2986ae" paddingLeft='-10'/></NeuMorph>
						</TouchableOpacity>
						<TouchableOpacity onPress={handlePlayAndPause}>
							<LinearGradient style={[styles.playAndPauseBtn, !song?.soundObj?.isPlaying && { paddingLeft: 4 }]} colors={['#dfa5a5', '#dfa5a5']}>
								<NeuMorph size={70}><Icon name={song?.soundObj?.isPlaying ? `pause` : `play`} color="#7c2d2d" /></NeuMorph>
							</LinearGradient>
						</TouchableOpacity>
						<TouchableOpacity style={styles.btn} onPress={() => (song?.soundObj?.isPlaying ? handleStop(() => {}) : () => {})} disabled={actions?.stop}>
							<Animated.View style={{ opacity: stopBtnAnim }}>
								<NeuMorph size={70}><Icon family="Ionicons" name="stop-outline" color="#167472" /></NeuMorph>
							</Animated.View>
						</TouchableOpacity>
						<TouchableOpacity onPress={handleNext}>
                            <NeuMorph size={70}><Icon name="skip-forward" color="#209722" /></NeuMorph>			
						</TouchableOpacity>
					</View>
				</View>
			</ImageBackground>
		</>
	);
};

const mapStateToProps = (state) => ({ song: state?.player?.currentSong, songs: state?.player?.songs });
const mapDispatchToProps = (dispatch) => ({ dispatch });
export default connect(mapStateToProps, mapDispatchToProps)(memo(Index));

const styles = StyleSheet.create({
	container: {
		flex: 1,
		paddingTop: Constants.statusBarHeight,
	},
	overlay: {
		position: 'absolute',
		top: 0,
		right: 0,
		bottom: 0,
		left: 0,
		backgroundColor: '#dfa5a5',
	},
	frame: {
		flex: 1,
		justifyContent: 'space-evenly',
		alignItems: 'center',
		elevation:10,
	},
	clipart: {
		width: 350,
		height: 350,
	},
	details: {
		width: '85%',
	},
	songTitle: {
		color: '#000000',
		fontSize: 24,
		fontWeight: 'bold',
		letterSpacing: 1,
		elevation:10,
	},
	artistName: {
		color: '#000000',
		elevation:10,
	},
	tracker: {
		backgroundColor: 'rgba(255, 255, 255, .2)',
		borderRadius: 100,
	},
	minMin: {
		color: '#000000',
	},
	maxMin: {
		color: '#000000',
	},
	actionsContainer: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		width: 325,
	},
	playAndPauseBtn: {
		justifyContent: 'center',
		alignItems: 'center',
		width: 60,
		height: 60,
	},
	inner: {
           backgroundColor: '#dfa5a5',
		   alignItems: 'center',
		   justifyContent: 'center',
		   borderColor: '#E2ECFD',
		   borderWidth: 1,
		   elevation:10,
	},
	topshadow: {
		shadowOffset:{
			width:-6,
			height:-6,
		},
		shadowOpacity: 1,
		shadowRadius: 150,
        shadowColor: 'rgba(70,70,70,0.2)',
	},
	bottomshadow: {
		shadowOffset:{
			width:6,
			height:6,
		},
		shadowOpacity: 1,
		shadowRadius: 150,
		shadowColor: 'rgba(255,255,255,0.5)',
	},
	playing: {
         color: '#91A1BD',
		 fontWeight:'800',
	}
});
