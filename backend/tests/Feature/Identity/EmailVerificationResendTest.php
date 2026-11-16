<?php

declare(strict_types=1);

use App\Modules\Identity\Http\Controllers\ResendEmailVerificationController;
use App\Modules\Identity\Jobs\SendEmailVerificationLink;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Notifications\VerifyEmailNotification;
use App\Shared\Audit\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Testing\TestResponse;

const ROUTE_RENVOI = '/api/v1/auth/email/verification-notification';

/**
 * @return array<string, mixed>
 */
function corpsRenvoi(TestResponse $reponse): array
{
    $corps = $reponse->json();
    unset($corps['request_id']);

    return $corps;
}

it('renvoie un lien signé qui se consomme tel quel, sans session', function (): void {
    Notification::fake();
    $user = User::factory()->unverified()->create(['email' => 'jeanne@exemple.fr']);

    $this->postJson(ROUTE_RENVOI, ['email' => 'Jeanne@Exemple.fr'])
        ->assertStatus(202)
        ->assertExactJson(['message' => ResendEmailVerificationController::MESSAGE]);

    $jeton = null;
    Notification::assertSentToTimes($user, VerifyEmailNotification::class, 1);
    Notification::assertSentTo($user, VerifyEmailNotification::class, function (VerifyEmailNotification $n) use ($user, &$jeton): bool {
        parse_str((string) parse_url((string) $n->toMail($user)->actionUrl, PHP_URL_QUERY), $requete);
        $jeton = $requete['jeton'];

        return true;
    });

    expect(parse_url((string) $jeton, PHP_URL_PATH))->toStartWith('/api/v1/auth/email/verify/');
    $this->assertGuest('web');
    $this->assertGuest('sanctum');
    expect(DB::table('sessions')->count())->toBe(0);

    $this->postJson((string) $jeton)->assertOk();
    expect($user->refresh()->hasVerifiedEmail())->toBeTrue();
});

it('n\'ouvre aucune session et ne pose aucun cookie', function (): void {
    User::factory()->unverified()->create(['email' => 'jeanne@exemple.fr']);

    $reponse = $this->postJson(ROUTE_RENVOI, ['email' => 'jeanne@exemple.fr'])->assertStatus(202);

    $this->assertGuest('web');
    $this->assertGuest('sanctum');
    expect($reponse->headers->getCookies())->toBe([])
        ->and(DB::table('sessions')->count())->toBe(0);
});

it('répond de façon identique pour un compte à vérifier, inconnu ou déjà vérifié', function (): void {
    Notification::fake();
    User::factory()->unverified()->create(['email' => 'a-verifier@exemple.fr']);
    User::factory()->create(['email' => 'verifie@exemple.fr']);

    $reponses = array_map(
        fn (string $email): TestResponse => $this->postJson(ROUTE_RENVOI, ['email' => $email]),
        ['a-verifier@exemple.fr', 'inconnu@exemple.fr', 'verifie@exemple.fr'],
    );

    foreach ($reponses as $reponse) {
        expect($reponse->getStatusCode())->toBe(202)
            ->and(corpsRenvoi($reponse))->toBe(corpsRenvoi($reponses[0]))
            ->and($reponse->headers->get('Content-Type'))->toBe($reponses[0]->headers->get('Content-Type'));
    }

    Notification::assertSentToTimes(User::query()->where('email', 'a-verifier@exemple.fr')->sole(), VerifyEmailNotification::class, 1);
});

it('n\'envoie rien à un compte inconnu, déjà vérifié ou supprimé', function (): void {
    Notification::fake();
    User::factory()->create(['email' => 'verifie@exemple.fr']);
    $supprime = User::factory()->unverified()->create(['email' => 'supprime@exemple.fr']);
    $supprime->delete();

    foreach (['inconnu@exemple.fr', 'verifie@exemple.fr', 'supprime@exemple.fr'] as $email) {
        $this->postJson(ROUTE_RENVOI, ['email' => $email])->assertStatus(202);
    }

    Notification::assertNothingSent();
    expect(AuditLog::query()->where('action', 'auth.email.verification.resent')->count())->toBe(0);
});

it('met la même tâche en file dans tous les cas, sans branche observable', function (): void {
    Queue::fake();
    User::factory()->unverified()->create(['email' => 'a-verifier@exemple.fr']);
    User::factory()->create(['email' => 'verifie@exemple.fr']);

    foreach (['a-verifier@exemple.fr', 'inconnu@exemple.fr', 'verifie@exemple.fr'] as $email) {
        $this->postJson(ROUTE_RENVOI, ['email' => $email])->assertStatus(202);
    }

    Queue::assertPushed(SendEmailVerificationLink::class, 3);
});

it('ne laisse pas l\'adresse en clair dans la file', function (): void {
    config(['queue.default' => 'database']);

    $this->postJson(ROUTE_RENVOI, ['email' => 'jeanne@exemple.fr'])->assertStatus(202);

    $payload = (string) DB::table('jobs')->value('payload');

    expect(DB::table('jobs')->count())->toBe(1)
        ->and($payload)->not->toContain('jeanne@exemple.fr')
        ->and(json_decode($payload, true)['data']['command'])->not->toStartWith('O:');
});

it('audite l\'envoi sans l\'adresse e-mail', function (): void {
    $user = User::factory()->unverified()->create(['email' => 'jeanne@exemple.fr']);

    $this->postJson(ROUTE_RENVOI, ['email' => 'jeanne@exemple.fr'])->assertStatus(202);

    $entree = AuditLog::query()->where('action', 'auth.email.verification.resent')->sole();

    expect($entree->subject_id)->toBe($user->id)
        ->and(json_encode($entree->toArray()))->not->toContain('jeanne@exemple.fr');
});

it('limite les renvois par adresse, quelles que soient la casse et l\'IP', function (): void {
    Notification::fake();
    $user = User::factory()->unverified()->create(['email' => 'jeanne@exemple.fr']);

    $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.10'])->postJson(ROUTE_RENVOI, ['email' => 'jeanne@exemple.fr'])->assertStatus(202);
    $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.11'])->postJson(ROUTE_RENVOI, ['email' => ' JEANNE@exemple.fr '])->assertStatus(429);
    $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.12'])->postJson(ROUTE_RENVOI, ['email' => 'autre@exemple.fr'])->assertStatus(202);

    Notification::assertSentToTimes($user, VerifyEmailNotification::class, 1);
});

it('applique aussi la limite par adresse à un compte inconnu, sans rien révéler', function (): void {
    $this->postJson(ROUTE_RENVOI, ['email' => 'inconnu@exemple.fr'])->assertStatus(202);
    $this->postJson(ROUTE_RENVOI, ['email' => 'inconnu@exemple.fr'])->assertStatus(429);
});

it('plafonne les renvois par adresse sur une heure', function (): void {
    for ($i = 0; $i < 5; $i++) {
        $this->postJson(ROUTE_RENVOI, ['email' => 'jeanne@exemple.fr'])->assertStatus(202);
        $this->travel(61)->seconds();
    }

    $this->postJson(ROUTE_RENVOI, ['email' => 'jeanne@exemple.fr'])->assertStatus(429);
});

it('limite la route par le limiteur auth commun, par IP', function (): void {
    $statuts = [];

    for ($i = 0; $i < 40; $i++) {
        $statuts[] = $this->postJson(ROUTE_RENVOI, ['email' => "adresse-{$i}@exemple.fr"])->getStatusCode();
    }

    expect($statuts)->toContain(429)->and($statuts[0])->toBe(202);
});

it('hache la clé de limitation : jamais d\'adresse en clair', function (): void {
    $requete = Request::create(ROUTE_RENVOI, 'POST', ['email' => 'Jeanne@Exemple.fr']);
    $limites = RateLimiter::limiter('verification-resend');

    expect($limites)->toBeCallable();

    foreach ($limites($requete) as $limite) {
        expect($limite->key)->not->toContain('jeanne')->and($limite->key)->not->toContain('exemple');
    }
});

it('refuse une adresse absente ou mal formée', function (mixed $email): void {
    $this->postJson(ROUTE_RENVOI, $email === null ? [] : ['email' => $email])
        ->assertStatus(422)
        ->assertJsonValidationErrors('email');
})->with([null, 'pas-une-adresse', fn (): string => str_repeat('a', 250).'@exemple.fr']);

it('n\'accepte pas GET', function (): void {
    $this->getJson(ROUTE_RENVOI)->assertStatus(405);
});
