<?php

declare(strict_types=1);

use App\Modules\Identity\Http\Controllers\VerifyEmailFromLinkController;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Notifications\VerifyEmailNotification;
use App\Shared\Audit\AuditLog;
use Illuminate\Auth\Events\Verified;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;

function lienSigne(User $user, ?string $hash = null, int $minutes = 60): string
{
    return URL::temporarySignedRoute('identity.email.verify', now()->addMinutes($minutes), [
        'id' => $user->id,
        'hash' => $hash ?? sha1($user->email),
    ]);
}

/**
 * @return array<string, mixed>
 */
function corpsSansIdentifiant(TestResponse $reponse): array
{
    $corps = $reponse->json();
    unset($corps['request_id']);

    return $corps;
}

it('vérifie l\'e-mail sans session, révoque les jetons et audite', function (): void {
    $user = User::factory()->unverified()->create();
    $user->createToken('mobile', ['mobile']);

    $this->postJson(lienSigne($user))
        ->assertOk()
        ->assertExactJson(['message' => VerifyEmailFromLinkController::MESSAGE]);

    expect($user->refresh()->hasVerifiedEmail())->toBeTrue()
        ->and($user->tokens()->count())->toBe(0)
        ->and(DB::table('sessions')->where('user_id', $user->id)->count())->toBe(0)
        ->and(AuditLog::query()->where('action', 'auth.email.verified')->where('actor_user_id', $user->id)->exists())->toBeTrue();
    $this->assertGuest('web');
    $this->assertGuest('sanctum');
});

it('émet Verified une seule fois', function (): void {
    Event::fake([Verified::class]);
    $user = User::factory()->unverified()->create();
    $lien = lienSigne($user);

    $this->postJson($lien)->assertOk();
    $this->postJson($lien)->assertForbidden();

    Event::assertDispatchedTimes(Verified::class, 1);
});

it('répond de la même façon à tout lien inutilisable', function (string $cas): void {
    $cible = User::factory()->unverified()->create();
    $dejaUtilise = User::factory()->create();
    $supprime = User::factory()->unverified()->create();
    $supprime->delete();
    $inconnu = User::factory()->unverified()->make(['id' => (string) Str::uuid()]);

    $lien = match ($cas) {
        'altéré' => lienSigne($cible).'x',
        'expiré' => lienSigne($cible, minutes: -1),
        'hash faux' => lienSigne($cible, sha1('autre@exemple.fr')),
        'inconnu' => lienSigne($inconnu),
        'déjà utilisé' => lienSigne($dejaUtilise),
        'compte supprimé' => lienSigne($supprime),
    };

    $reponse = $this->postJson($lien)->assertForbidden();

    expect(corpsSansIdentifiant($reponse))->toBe([
        'type' => rtrim((string) config('app.url'), '/').'/problems/email_verification_link_invalid',
        'title' => 'Lien de confirmation invalide',
        'status' => 403,
        'detail' => 'Ce lien est invalide, expiré ou déjà utilisé.',
        'code' => 'email_verification_link_invalid',
    ])->and($cible->refresh()->hasVerifiedEmail())->toBeFalse();
})->with(['altéré', 'expiré', 'hash faux', 'inconnu', 'déjà utilisé', 'compte supprimé']);

it('refuse une signature falsifiée même avec le bon hash', function (): void {
    $user = User::factory()->unverified()->create();
    $autre = User::factory()->unverified()->create();
    $lienAutre = lienSigne($autre);
    $falsifie = str_replace($autre->id, $user->id, $lienAutre);

    $this->postJson($falsifie)->assertForbidden()->assertJsonPath('code', 'email_verification_link_invalid');

    expect($user->refresh()->hasVerifiedEmail())->toBeFalse()
        ->and($autre->refresh()->hasVerifiedEmail())->toBeFalse();
});

it('refuse une URL non signée', function (): void {
    $user = User::factory()->unverified()->create();

    $this->postJson(route('identity.email.verify', ['id' => $user->id, 'hash' => sha1($user->email)]))
        ->assertForbidden()
        ->assertJsonPath('code', 'email_verification_link_invalid');

    expect($user->refresh()->hasVerifiedEmail())->toBeFalse();
});

it('ne vérifie rien en GET', function (): void {
    $user = User::factory()->unverified()->create();

    $this->getJson(lienSigne($user))->assertStatus(405);

    expect($user->refresh()->hasVerifiedEmail())->toBeFalse();
});

it('laisse l\'adresse non vérifiée si un listener échoue, le lien reste utilisable', function (): void {
    $user = User::factory()->unverified()->create();
    $lien = lienSigne($user);
    $appels = 0;
    Event::listen(Verified::class, function () use (&$appels): void {
        if ($appels++ === 0) {
            throw new RuntimeException('panne');
        }
    });

    $this->postJson($lien)->assertStatus(500);
    expect($user->refresh()->hasVerifiedEmail())->toBeFalse();

    $this->postJson($lien)->assertOk();
    expect($user->refresh()->hasVerifiedEmail())->toBeTrue();
});

it('envoie un lien qui se consomme tel quel depuis le hub', function (): void {
    Notification::fake();
    $user = User::factory()->unverified()->create();
    $user->sendEmailVerificationNotification();
    $jeton = null;

    Notification::assertSentTo($user, VerifyEmailNotification::class, function (VerifyEmailNotification $n) use ($user, &$jeton): bool {
        parse_str((string) parse_url((string) $n->toMail($user)->actionUrl, PHP_URL_QUERY), $requete);
        $jeton = $requete['jeton'];

        return true;
    });

    expect(parse_url((string) $jeton, PHP_URL_PATH))->toStartWith('/api/v1/auth/email/verify/');
    $this->postJson((string) $jeton)->assertOk();
    expect($user->refresh()->hasVerifiedEmail())->toBeTrue();
});
