<?php

declare(strict_types=1);

use App\Modules\Notifications\Data\PushMessage;
use App\Modules\Notifications\Enums\PushResult;
use App\Modules\Notifications\Push\FcmDriver;
use App\Modules\Notifications\Push\PushChannel;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

beforeEach(function (): void {
    Cache::flush();
    $cle = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
    openssl_pkey_export($cle, $pem);
    $this->publique = openssl_pkey_get_details($cle)['key'];
    $this->fichier = tempnam(sys_get_temp_dir(), 'fcm');
    file_put_contents($this->fichier, json_encode(['client_email' => 'push@projet-test.iam.gserviceaccount.test', 'private_key' => $pem]));
    config([
        'notifications.push.driver' => 'fcm',
        'notifications.push.fcm.project_id' => 'projet-test',
        'notifications.push.fcm.credentials' => $this->fichier,
    ]);
    $this->message = new PushMessage('eGuardImmo', 'Un loyer est en retard.', 'notif-1', '/finances/impayes');
});

afterEach(function (): void {
    @unlink($this->fichier);
});

function fcmRepond(array $fcm): void
{
    Http::fake([
        'oauth2.googleapis.com/*' => Http::response(['access_token' => 'jeton-oauth', 'expires_in' => 3600]),
        'fcm.googleapis.com/*' => $fcm['reponse'],
    ]);
}

it('envoie par FCM HTTP v1 avec un jeton OAuth signé RS256 et une charge utile minimale', function (): void {
    fcmRepond(['reponse' => Http::response(['name' => 'projects/projet-test/messages/1'])]);

    $resultat = app(FcmDriver::class)->send('jeton-appareil-0123456789', $this->message);

    expect($resultat)->toBe(PushResult::Sent);
    Http::assertSent(function (Request $r): bool {
        if (str_contains($r->url(), 'oauth2.googleapis.com')) {
            parse_str($r->body(), $form);
            $jwt = JWT::decode($form['assertion'], new Key($this->publique, 'RS256'));

            return $jwt->iss === 'push@projet-test.iam.gserviceaccount.test' && $jwt->scope === 'https://www.googleapis.com/auth/firebase.messaging';
        }

        $message = $r->data()['message'];

        return $r->url() === 'https://fcm.googleapis.com/v1/projects/projet-test/messages:send'
            && $r->hasHeader('Authorization', 'Bearer jeton-oauth')
            && $message['token'] === 'jeton-appareil-0123456789'
            && $message['notification'] === ['title' => 'eGuardImmo', 'body' => 'Un loyer est en retard.']
            && $message['data'] === ['notification_id' => 'notif-1', 'link' => '/finances/impayes'];
    });
});

it('met le jeton OAuth en cache entre deux envois', function (): void {
    fcmRepond(['reponse' => Http::response([])]);

    app(FcmDriver::class)->send('jeton-appareil-0123456789', $this->message);
    app(FcmDriver::class)->send('jeton-appareil-0123456789', $this->message);

    Http::assertSentCount(3);
});

it('reconnaît un jeton d\'appareil périmé', function (): void {
    fcmRepond(['reponse' => Http::response(['error' => ['status' => 'NOT_FOUND']], 404)]);

    expect(app(FcmDriver::class)->send('jeton-appareil-0123456789', $this->message))->toBe(PushResult::InvalidToken);
});

it('traite une indisponibilité du service comme un échec, pas comme un jeton périmé', function (): void {
    fcmRepond(['reponse' => Http::response(['error' => ['status' => 'UNAVAILABLE']], 503)]);

    expect(app(FcmDriver::class)->send('jeton-appareil-0123456789', $this->message))->toBe(PushResult::Failed);
});

it('oublie le jeton OAuth refusé pour en redemander un', function (): void {
    fcmRepond(['reponse' => Http::response([], 401)]);

    expect(app(FcmDriver::class)->send('jeton-appareil-0123456789', $this->message))->toBe(PushResult::Failed)
        ->and(Cache::get('notifications.fcm.access_token'))->toBeNull();
});

it('ne lève jamais : réseau coupé, compte de service absent ou projet invalide donnent un échec', function (): void {
    Http::fake(fn () => throw new ConnectionException('réseau coupé'));
    expect(app(FcmDriver::class)->send('jeton-appareil-0123456789', $this->message))->toBe(PushResult::Failed);

    Cache::put('notifications.fcm.access_token', 'jeton-oauth');
    expect(app(FcmDriver::class)->send('jeton-appareil-0123456789', $this->message))->toBe(PushResult::Failed);

    Cache::flush();
    config(['notifications.push.fcm.credentials' => '/chemin/absent.json']);
    expect(app(FcmDriver::class)->send('jeton-appareil-0123456789', $this->message))->toBe(PushResult::Failed);

    file_put_contents($this->fichier, '{"client_email":"x"}');
    config(['notifications.push.fcm.credentials' => $this->fichier]);
    expect(app(FcmDriver::class)->send('jeton-appareil-0123456789', $this->message))->toBe(PushResult::Failed);

    config(['notifications.push.fcm.project_id' => '../evil']);
    expect(app(FcmDriver::class)->send('jeton-appareil-0123456789', $this->message))->toBe(PushResult::Failed);
});

it('ne journalise ni le jeton d\'appareil ni le contenu du message', function (): void {
    $lignes = [];
    Log::listen(function ($evenement) use (&$lignes): void {
        $lignes[] = $evenement->message.json_encode($evenement->context);
    });
    fcmRepond(['reponse' => Http::response(['error' => ['status' => 'INTERNAL']], 500)]);

    app(FcmDriver::class)->send('jeton-appareil-0123456789', $this->message);

    expect(implode('|', $lignes))->not->toContain('jeton-appareil-0123456789')->not->toContain('Un loyer est en retard');
});

it('reste désactivé par défaut : sans variable d\'environnement, rien ne part', function (): void {
    $defaut = require config_path('notifications.php');

    expect($defaut['push']['driver'])->toBe('none');
    config(['notifications.push.driver' => 'none']);
    expect(app(PushChannel::class)->enabled())->toBeFalse();
});
