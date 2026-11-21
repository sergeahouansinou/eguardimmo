<?php

declare(strict_types=1);

use App\Modules\Identity\Events\AccountDeleted;
use App\Modules\Identity\Models\User;
use App\Modules\Notifications\Enums\NotificationType as Type;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Notifications\Models\PushToken;
use App\Modules\Notifications\Push\FakeDriver;
use App\Modules\Recovery\Events\RecoveryBundleSent;
use App\Modules\Rent\Events\InstallmentOverdue;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Tests\Feature\Notifications\NotificationsContext as N;
use Tests\Feature\Rent\RentContext as C;
use Tests\Feature\Tenant\TenantContext as T;

beforeEach(function (): void {
    C::preparer($this);
    config(['notifications.push.driver' => 'fake']);
    $this->org = C::organisation();
    $this->equipe = N::equipe($this->org);
    ['lease' => $this->bail] = T::locataire($this->org);
    $this->fake = app(FakeDriver::class);
    $this->owner = $this->equipe['owner'];
});

function enregistrer(object $test, string $plain, ?string $jeton = null, array $surcharges = []): TestResponse
{
    auth()->forgetGuards();

    return $test->withToken($plain)->postJson('/api/v1/me/push-tokens', ['token' => $jeton ?? N::jetonAppareil(), 'platform' => 'android', 'device_name' => 'Pixel 8', ...$surcharges]);
}

function retard(object $test): void
{
    event(new InstallmentOverdue(Str::uuid7()->toString(), $test->bail->id, $test->org->id, '2026-11-05'));
}

it('enregistre le jeton d\'un appareil depuis une session mobile, chiffré, et ne le renvoie jamais', function (): void {
    $session = N::sessionMobile($this->owner);
    $jeton = N::jetonAppareil();

    $reponse = enregistrer($this, $session['plain'], $jeton)->assertCreated();

    expect($reponse->json('data'))->toHaveKeys(['id', 'platform', 'device_name', 'registered_at'])->not->toHaveKey('token')
        ->and($reponse->getContent())->not->toContain($jeton)
        ->and($reponse->json('data.platform'))->toBe('android');

    $ligne = DB::table('push_tokens')->first();
    expect($ligne->token)->not->toBe($jeton)->and($ligne->token)->not->toContain($jeton)
        ->and($ligne->token_hash)->toBe(hash('sha256', $jeton))
        ->and($ligne->access_token_id)->toBe($session['id'])
        ->and($ligne->user_id)->toBe($this->owner->id)
        ->and(PushToken::query()->first()?->token)->toBe($jeton);

    enregistrer($this, $session['plain'], $jeton)->assertOk();
    expect(PushToken::query()->count())->toBe(1);
});

it('refuse l\'enregistrement hors session mobile et valide le corps', function (): void {
    N::comme($this, $this->owner);
    $this->postJson('/api/v1/me/push-tokens', ['token' => N::jetonAppareil(), 'platform' => 'android'])->assertForbidden()->assertJsonPath('code', 'push_token_mobile_session_required');

    $web = $this->owner->createToken('autre', ['quelque-chose'])->plainTextToken;
    enregistrer($this, $web)->assertForbidden();

    $session = N::sessionMobile($this->owner)['plain'];
    enregistrer($this, $session, 'court')->assertUnprocessable();
    enregistrer($this, $session, null, ['platform' => 'windows'])->assertUnprocessable();
    enregistrer($this, $session, null, ['device_name' => str_repeat('x', 121)])->assertUnprocessable();
    enregistrer($this, $session, null, ['user_id' => $this->equipe['manager']->id])->assertCreated();
    expect(PushToken::query()->count())->toBe(1)->and(PushToken::query()->first()?->user_id)->toBe($this->owner->id);
});

it('un jeton d\'appareil n\'appartient qu\'à un compte : le dernier à l\'enregistrer le détient', function (): void {
    $jeton = N::jetonAppareil();
    enregistrer($this, N::sessionMobile($this->owner)['plain'], $jeton)->assertCreated();
    enregistrer($this, N::sessionMobile($this->equipe['manager'])['plain'], $jeton)->assertOk();

    expect(PushToken::query()->count())->toBe(1)->and(PushToken::query()->first()?->user_id)->toBe($this->equipe['manager']->id);

    retard($this);

    expect($this->fake->sent)->toHaveCount(1)
        ->and(N::premiere($this->owner, Type::RentOverdue)->pushed_at)->toBeNull()
        ->and(N::premiere($this->equipe['manager'], Type::RentOverdue)->pushed_at)->not->toBeNull();
});

it('un nouveau jeton de la même session remplace l\'ancien', function (): void {
    $session = N::sessionMobile($this->owner);
    enregistrer($this, $session['plain'], N::jetonAppareil())->assertCreated();
    enregistrer($this, $session['plain'], N::jetonAppareil())->assertCreated();

    expect(PushToken::query()->whereNull('revoked_at')->count())->toBe(1)->and(PushToken::query()->count())->toBe(2);
});

it('envoie un push générique : aucune référence, aucun montant, seulement l\'identifiant et le lien', function (): void {
    enregistrer($this, N::sessionMobile($this->owner)['plain'], $jeton = N::jetonAppareil())->assertCreated();

    retard($this);

    expect($this->fake->sent)->toHaveCount(1);
    $envoi = $this->fake->sent[0];
    $n = N::premiere($this->owner, Type::RentOverdue);

    expect($envoi['token'])->toBe($jeton)
        ->and($envoi['message']->title)->toBe('eGuardImmo')
        ->and($envoi['message']->body)->toBe('Un loyer est en retard.')
        ->and($envoi['message']->notificationId)->toBe($n->id)
        ->and($envoi['message']->link)->toBe('/finances/impayes')
        ->and(json_encode($envoi['message']))->not->toContain($this->bail->reference)->not->toContain('05/11/2026')
        ->and($n->pushed_at)->not->toBeNull();
});

it('ne renvoie pas un push déjà parti, même si l\'événement est rejoué', function (): void {
    enregistrer($this, N::sessionMobile($this->owner)['plain'])->assertCreated();
    $evenement = new InstallmentOverdue(Str::uuid7()->toString(), $this->bail->id, $this->org->id, '2026-11-05');

    event($evenement);
    event($evenement);

    expect($this->fake->sent)->toHaveCount(1);
});

it('n\'envoie rien tant que le pilote est désactivé', function (): void {
    config(['notifications.push.driver' => 'none']);
    enregistrer($this, N::sessionMobile($this->owner)['plain'])->assertCreated();

    retard($this);

    expect($this->fake->sent)->toHaveCount(0)->and(N::premiere($this->owner, Type::RentOverdue)->pushed_at)->toBeNull();
});

it('un jeton révoqué par son propriétaire ne reçoit plus rien, un autre compte ne peut pas le révoquer', function (): void {
    $session = N::sessionMobile($this->owner);
    $id = enregistrer($this, $session['plain'])->assertCreated()->json('data.id');

    N::comme($this, $this->equipe['manager']);
    $volee = $this->deleteJson("/api/v1/me/push-tokens/{$id}")->assertNotFound()->assertJsonPath('code', 'push_token_not_found');
    $inconnu = $this->deleteJson('/api/v1/me/push-tokens/'.Str::uuid7()->toString())->assertNotFound();
    expect($volee->json('detail'))->toBe($inconnu->json('detail'))->and(PushToken::query()->whereNull('revoked_at')->count())->toBe(1);

    auth()->forgetGuards();
    $this->withToken($session['plain'])->deleteJson("/api/v1/me/push-tokens/{$id}")->assertNoContent();
    auth()->forgetGuards();
    $this->withToken($session['plain'])->deleteJson("/api/v1/me/push-tokens/{$id}")->assertNoContent();

    retard($this);

    $ligne = PushToken::query()->findOrFail($id);
    expect($this->fake->sent)->toHaveCount(0)->and($ligne->revoked_at)->not->toBeNull()
        ->and(DB::table('push_tokens')->where('id', $id)->value('token'))->toBeNull();
});

it('la déconnexion et la révocation d\'appareil coupent le push sans passer par Notifications', function (): void {
    $a = N::sessionMobile($this->owner, 'Appareil A');
    $b = N::sessionMobile($this->owner, 'Appareil B');
    enregistrer($this, $a['plain'])->assertCreated();
    enregistrer($this, $b['plain'])->assertCreated();

    auth()->forgetGuards();
    $this->withToken($a['plain'])->deleteJson('/api/v1/auth/token')->assertNoContent();

    retard($this);
    expect($this->fake->sent)->toHaveCount(1);

    auth()->forgetGuards();
    $this->withToken($b['plain'])->deleteJson("/api/v1/me/devices/{$b['id']}")->assertNoContent();

    event(new InstallmentOverdue(Str::uuid7()->toString(), $this->bail->id, $this->org->id, '2026-11-06'));
    expect($this->fake->sent)->toHaveCount(1);
});

it('un jeton de session expiré ne reçoit plus rien et la commande le révoque', function (): void {
    $session = N::sessionMobile($this->owner);
    enregistrer($this, $session['plain'])->assertCreated();
    DB::table('personal_access_tokens')->where('id', $session['id'])->update(['expires_at' => now()->subMinute()]);

    retard($this);
    expect($this->fake->sent)->toHaveCount(0);

    $this->artisan('notifications:prune-push-tokens')->expectsOutputToContain('1 jeton(s) push révoqué(s)')->assertSuccessful();
    $this->artisan('notifications:prune-push-tokens')->expectsOutputToContain('0 jeton(s) push révoqué(s)')->assertSuccessful();

    expect(PushToken::query()->whereNull('revoked_at')->count())->toBe(0)
        ->and(DB::table('push_tokens')->value('token'))->toBeNull();
});

it('un jeton refusé par le service est révoqué, les autres appareils reçoivent', function (): void {
    $session = N::sessionMobile($this->owner);
    enregistrer($this, $session['plain'], $mort = N::jetonAppareil())->assertCreated();
    enregistrer($this, N::sessionMobile($this->owner, 'Tablette')['plain'], $vivant = N::jetonAppareil())->assertCreated();
    $this->fake->invalidTokens = [$mort];

    retard($this);

    expect(array_column($this->fake->sent, 'token'))->toBe([$vivant])
        ->and(PushToken::query()->whereNull('revoked_at')->count())->toBe(1)
        ->and(PushToken::query()->where('token_hash', hash('sha256', $mort))->first()?->revoked_at)->not->toBeNull();
});

it('un échec du push ne bloque ni le centre ni l\'e-mail', function (): void {
    Mail::fake();
    enregistrer($this, N::sessionMobile($this->owner)['plain'])->assertCreated();
    $this->fake->failing = true;

    retard($this);

    $n = N::premiere($this->owner, Type::RentOverdue);
    expect($n->in_app)->toBeTrue()->and($n->pushed_at)->toBeNull()->and($n->emailed_at)->not->toBeNull()
        ->and(PushToken::query()->whereNull('revoked_at')->count())->toBe(1);
});

it('plafonne le nombre de push par compte et par heure sans perdre la notification', function (): void {
    config(['notifications.push.per_user_per_hour' => 2]);
    N::comme($this, $this->owner);
    $this->putJson(N::URL.'/preferences', ['preferences' => [['type' => 'recovery.bundle_sent', 'channel' => 'push', 'enabled' => true]]])->assertOk();
    enregistrer($this, N::sessionMobile($this->owner)['plain'])->assertCreated();

    foreach (range(1, 4) as $i) {
        event(new RecoveryBundleSent($this->org->id, Str::uuid7()->toString(), 'jeton-'.$i));
    }

    expect($this->fake->sent)->toHaveCount(2)->and(N::nombre($this->owner, Type::RecoveryBundleSent))->toBe(4);
});

it('un compte supprimé voit ses appareils révoqués et ses notifications archivées, rien n\'est effacé', function (): void {
    enregistrer($this, N::sessionMobile($this->owner)['plain'])->assertCreated();
    retard($this);

    event(new AccountDeleted($this->owner->id));

    expect(PushToken::query()->whereNull('revoked_at')->count())->toBe(0)
        ->and(Notification::query()->where('user_id', $this->owner->id)->whereNull('archived_at')->count())->toBe(0)
        ->and(Notification::query()->where('user_id', $this->owner->id)->count())->toBe(1);

    N::comme($this, User::query()->findOrFail($this->owner->id));
    $this->getJson(N::URL)->assertOk()->assertJsonCount(0, 'data');
});
