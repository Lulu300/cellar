import { afterEach, describe, expect, it, vi } from 'vitest';
import { m } from '#lib/paraglide/messages.js';
import { useLocale } from '../../../test/locale';
import { cameraErrorMessage, cameraUnavailableMessage } from './camera-error';

/** An error as Firefox and Safari have thrown it: a plain object with a name, no DOMException. */
const browserError = (name: string) => ({ name, message: 'The request is not allowed' });

describe('cameraErrorMessage', () => {
    it('reads a refusal by its name, whatever the class of the error', () => {
        for (const error of [
            new DOMException('Permission denied', 'NotAllowedError'),
            browserError('NotAllowedError'),
            browserError('PermissionDeniedError'),
            browserError('SecurityError')
        ]) {
            expect(cameraErrorMessage(error)).toBe(m['scanner.permission_denied']());
        }
    });

    it('tells a missing camera, including one chosen that is gone', () => {
        for (const name of ['NotFoundError', 'DevicesNotFoundError', 'OverconstrainedError']) {
            expect(cameraErrorMessage(browserError(name))).toBe(m['scanner.no_camera']());
        }
    });

    it('never shows the English message of the browser', () => {
        useLocale('fr');
        const message = cameraErrorMessage(new Error('Could not start video source'));
        expect(message).toBe('Le scanner n’a pas pu démarrer.');
        expect(cameraErrorMessage(null)).toBe(message);
        expect(cameraErrorMessage('failed')).toBe(message);
    });
});

describe('cameraUnavailableMessage', () => {
    afterEach(() => vi.unstubAllGlobals());

    const browser = (isSecureContext: boolean, mediaDevices?: object) => {
        vi.stubGlobal('window', { isSecureContext });
        vi.stubGlobal('navigator', { mediaDevices });
    };

    it('asks for HTTPS on a plain http:// address of the network, even with mediaDevices', () => {
        browser(false, { getUserMedia: () => {} });
        expect(cameraUnavailableMessage()).toBe(m['scanner.camera_unavailable']());
        browser(false);
        expect(cameraUnavailableMessage()).toBe(m['scanner.camera_unavailable']());
    });

    // HTTPS would not help a browser or a webview that has no camera API.
    it('names a secure browser without a camera API', () => {
        browser(true);
        expect(cameraUnavailableMessage()).toBe(m['scanner.no_camera_api']());
    });

    it('is null over HTTPS when the browser has a camera API', () => {
        browser(true, { getUserMedia: () => {} });
        expect(cameraUnavailableMessage()).toBeNull();
    });
});
