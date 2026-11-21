<?php

declare(strict_types=1);

use App\Modules\Identity\Http\Middleware\EnsureRecentReauthentication;
use App\Modules\Identity\Models\EmailChangeRequest;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Notifications\EmailChangeAddressTakenNotification;
use App\Modules\Identity\Notifications\EmailChangeCodeNotification;
use App\Modules\Identity\Notifications\EmailChangedNotification;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;

const ORIGINE_COMPTE = ['Origin' => 'https://agence.eguardimmo.test', 'Referer' => 'https://agence.eguardimmo.test/'];

beforeEach(function (): void {
    config(['sanctum.stateful' => ['agence.eguardimmo.test']]);
    Notification::fake();
    $this->user = User::factory()->create(['email' => 'ancienne@exemple.fr', 'name' => 'Awa Diallo']);
    $this->reauth = [EnsureRecentReauthentication::CLE_MOT_DE_PASSE => now()->getTimestamp()];
    $this->appeler = function (string $methode, string $url, array $corps = [], bool $reauth = true) {
        $this->flushSession();

        return ($reauth ? $this->withSession($this->reauth) : $this)
            ->actingAs($this->user, 'web')->json($methode, '/api/v1/me'.$url, $corps, ORIGINE_COMPTE);
    };
    $this->codeEnvoye = function (string $adresse): string {
        $code = null;
        Notification::assertSentOnDemand(EmailChangeCodeNotification::class, function (EmailChangeCodeNotification $n, array $canaux, AnonymousNotifiable $cible) use ($adresse, &$code): bool {
            if ($cible->routes['mail'] !== $adresse) {
                return false;
            }
            $code = $n->toMail($cible)->introLines[1];

            return true;
        });

        return (string) $code;
    };
});

it('modifie le nom seul, sans toucher à l\'adresse ni au mot de passe', function (): void {
    $hash = $this->user->password;

    ($this->appeler)('PATCH', '', ['name' => '  Awa Koné  ', 'email' => 'pirate@exemple.fr', 'password' => 'x'], false)
        ->assertOk()->assertJsonPath('data.name', 'Awa Koné')->assertJsonPath('data.email', 'ancienne@exemple.fr');

    expect($this->user->fresh()->email)->toBe('ancienne@exemple.fr')->and($this->user->fresh()->password)->toBe($hash);
    ($this->appeler)('PATCH', '', ['name' => 'A'], false)->assertUnprocessable();
    ($this->appeler)('PATCH', '', ['name' => '<script>'], false)->assertUnprocessable();
    auth()->forgetGuards();
    $this->flushSession();
    $this->patchJson('/api/v1/me', ['name' => 'Anonyme'])->assertUnauthorized();
});

it('enregistre le téléphone déclaratif en E.164, chiffré, jamais vérifié', function (): void {
    ($this->appeler)('PUT', '/phone', ['phone' => '+33 6 12 34 56 78'])->assertOk()->assertJsonPath('data.phone', '+33612345678');

    expect($this->user->fresh()->phone)->toBe('+33612345678')->and($this->user->fresh()->phone_verified_at)->toBeNull()
        ->and(DB::table('users')->where('id', $this->user->id)->value('phone'))->not->toContain('612345678');

    ($this->appeler)('PUT', '/phone', ['phone' => '0612345678'])->assertUnprocessable()->assertJsonPath('code', 'phone_invalid');
    ($this->appeler)('PUT', '/phone', ['phone' => null])->assertOk()->assertJsonPath('data.phone', null);
    ($this->appeler)('PUT', '/phone', ['phone' => '+33612345678'], false)->assertForbidden()->assertJsonPath('code', 'reauthentication_required');
    expect(DB::table('audit_logs')->where('action', 'identity.phone.updated')->count())->toBe(2)
        ->and((string) DB::table('audit_logs')->where('action', 'identity.phone.updated')->pluck('metadata')->implode(''))->not->toContain('612345678');
});

it('change l\'adresse par un code envoyé à la nouvelle adresse, révoque les autres sessions et jetons, prévient l\'ancienne', function (): void {
    $this->user->createToken('iphone', ['mobile']);
    DB::table('sessions')->insert(['id' => 'autre-session', 'user_id' => $this->user->id, 'payload' => 'x', 'last_activity' => now()->getTimestamp()]);

    ($this->appeler)('POST', '/email-change', ['email' => 'Nouvelle@Exemple.fr'])->assertStatus(202)->assertJsonPath('data.status', 'code_sent');
    $code = ($this->codeEnvoye)('nouvelle@exemple.fr');

    expect($code)->toMatch('/^\d{6}$/')
        ->and(EmailChangeRequest::query()->count())->toBe(1)
        ->and(DB::table('email_change_requests')->value('email'))->not->toContain('exemple')
        ->and(DB::table('email_change_requests')->value('code_hash'))->not->toContain($code);

    ($this->appeler)('POST', '/email-change/confirmation', ['code' => $code], false)->assertOk()->assertJsonPath('data.email', 'nouvelle@exemple.fr');

    $moi = $this->user->fresh();
    expect($moi->email)->toBe('nouvelle@exemple.fr')->and($moi->email_verified_at)->not->toBeNull()
        ->and($moi->tokens()->count())->toBe(0)
        ->and(DB::table('sessions')->where('id', 'autre-session')->exists())->toBeFalse();
    Notification::assertSentOnDemand(EmailChangedNotification::class, fn ($n, $canaux, AnonymousNotifiable $cible): bool => $cible->routes['mail'] === 'ancienne@exemple.fr');
    expect(DB::table('audit_logs')->whereIn('action', ['identity.email_change.requested', 'identity.email_change.confirmed'])->count())->toBe(2);

    ($this->appeler)('POST', '/email-change/confirmation', ['code' => $code], false)->assertUnprocessable()->assertJsonPath('code', 'email_change_code_invalid');
});

it('refuse un code faux, expiré ou inconnu sans les distinguer, et bloque au sixième essai', function (): void {
    ($this->appeler)('POST', '/email-change', ['email' => 'nouvelle@exemple.fr'])->assertStatus(202);
    $code = ($this->codeEnvoye)('nouvelle@exemple.fr');
    $faux = $code === '000000' ? '111111' : '000000';

    foreach (range(1, 4) as $_) {
        ($this->appeler)('POST', '/email-change/confirmation', ['code' => $faux], false)->assertUnprocessable()->assertJsonPath('code', 'email_change_code_invalid');
    }
    $this->travel(61)->seconds();
    ($this->appeler)('POST', '/email-change/confirmation', ['code' => $faux], false)->assertUnprocessable()->assertJsonPath('code', 'email_change_code_invalid');
    ($this->appeler)('POST', '/email-change/confirmation', ['code' => $code], false)->assertStatus(429)->assertJsonPath('code', 'email_change_attempts_exceeded');
    expect($this->user->fresh()->email)->toBe('ancienne@exemple.fr');

    ($this->appeler)('POST', '/email-change', ['email' => 'autre@exemple.fr'])->assertStatus(202);
    $nouveau = ($this->codeEnvoye)('autre@exemple.fr');
    $this->travel(16)->minutes();
    ($this->appeler)('POST', '/email-change/confirmation', ['code' => $nouveau], false)->assertUnprocessable()->assertJsonPath('code', 'email_change_code_invalid');
    ($this->appeler)('POST', '/email-change/confirmation', ['code' => 'abc'], false)->assertUnprocessable();
});

it('répond pareil quand l\'adresse est déjà prise, sans code, et prévient son titulaire', function (): void {
    $titulaire = User::factory()->create(['email' => 'prise@exemple.fr']);

    $libre = ($this->appeler)('POST', '/email-change', ['email' => 'libre@exemple.fr'])->assertStatus(202)->json();
    $prise = ($this->appeler)('POST', '/email-change', ['email' => 'Prise@exemple.fr'])->assertStatus(202)->json();

    expect($prise)->toBe($libre);
    Notification::assertSentTo($titulaire, EmailChangeAddressTakenNotification::class);
    Notification::assertSentOnDemandTimes(EmailChangeCodeNotification::class, 1);
    expect(EmailChangeRequest::query()->whereNull('consumed_at')->count())->toBe(1);

    ($this->appeler)('POST', '/email-change/confirmation', ['code' => '123456'], false)->assertUnprocessable()->assertJsonPath('code', 'email_change_code_invalid');
});

it('garde une seule demande vivante et permet de l\'annuler', function (): void {
    ($this->appeler)('POST', '/email-change', ['email' => 'un@exemple.fr'])->assertStatus(202);
    ($this->appeler)('POST', '/email-change', ['email' => 'deux@exemple.fr'])->assertStatus(202);
    expect(EmailChangeRequest::query()->whereNull('consumed_at')->count())->toBe(1);

    ($this->appeler)('DELETE', '/email-change', [], false)->assertNoContent();
    expect(EmailChangeRequest::query()->whereNull('consumed_at')->count())->toBe(0)
        ->and(DB::table('audit_logs')->where('action', 'identity.email_change.cancelled')->count())->toBe(1);
});

it('exige session web et confirmation récente', function (): void {
    ($this->appeler)('POST', '/email-change', ['email' => 'un@exemple.fr'], false)->assertForbidden()->assertJsonPath('code', 'reauthentication_required');
    auth()->forgetGuards();
    $this->flushSession();
    $this->postJson('/api/v1/me/email-change', ['email' => 'un@exemple.fr'])->assertUnauthorized();

    $jeton = $this->user->createToken('iphone', ['mobile'])->plainTextToken;
    auth()->forgetGuards();
    $this->withToken($jeton)->postJson('/api/v1/me/email-change', ['email' => 'un@exemple.fr'])->assertForbidden();
    auth()->forgetGuards();
});

it('limite à trois demandes de changement d\'adresse par heure', function (): void {
    foreach (['a', 'b', 'c'] as $n) {
        ($this->appeler)('POST', '/email-change', ['email' => "{$n}@exemple.fr"])->assertStatus(202);
    }
    ($this->appeler)('POST', '/email-change', ['email' => 'd@exemple.fr'])->assertStatus(429);
});

it('efface les demandes de changement d\'adresse de plus de 24 heures', function (): void {
    ($this->appeler)('POST', '/email-change', ['email' => 'un@exemple.fr'])->assertStatus(202);
    $this->travel(25)->hours();
    $this->artisan('identity:purge-email-changes')->assertSuccessful();

    expect(EmailChangeRequest::query()->count())->toBe(0);
});
