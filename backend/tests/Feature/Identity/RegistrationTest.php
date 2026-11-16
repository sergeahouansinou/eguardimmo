<?php

declare(strict_types=1);

use App\Modules\Identity\Events\UserRegistered;
use App\Modules\Identity\Http\Controllers\RegisterController;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Notifications\AccountAlreadyExistsNotification;
use App\Modules\Identity\Notifications\VerifyEmailNotification;
use App\Shared\Audit\AuditLog;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Notification;

function inscription(array $surcharges = []): array
{
    return array_merge([
        'name' => 'Jeanne Martin',
        'email' => 'Jeanne@Exemple.fr',
        'password' => 'motdepasse-solide',
        'password_confirmation' => 'motdepasse-solide',
        'intended_profile' => 'agency',
    ], $surcharges);
}

beforeEach(function (): void {
    Notification::fake();
});

it('inscrit un compte, envoie la vérification et émet UserRegistered sans ouvrir de session', function (): void {
    Event::fake([UserRegistered::class]);

    $this->postJson('/auth/register', inscription())
        ->assertStatus(202)
        ->assertExactJson(['message' => RegisterController::MESSAGE]);

    $user = User::query()->where('email', 'jeanne@exemple.fr')->sole();

    expect($user->email_verified_at)->toBeNull()
        ->and($user->password)->not->toBe('motdepasse-solide');
    Notification::assertSentTo($user, VerifyEmailNotification::class);
    Event::assertDispatched(UserRegistered::class, fn (UserRegistered $e): bool => $e->userId === $user->id && $e->intendedProfile->value === 'agency');
    $this->assertGuest('web');
});

it('répond comme un succès quand l\'e-mail existe déjà et prévient le titulaire', function (): void {
    $existant = User::factory()->create(['email' => 'jeanne@exemple.fr']);

    $this->postJson('/auth/register', inscription())
        ->assertStatus(202)
        ->assertExactJson(['message' => RegisterController::MESSAGE]);

    expect(User::query()->where('email', 'jeanne@exemple.fr')->count())->toBe(1);
    Notification::assertSentTo($existant, AccountAlreadyExistsNotification::class);
    Notification::assertNotSentTo($existant, VerifyEmailNotification::class);
});

it('refuse l\'inscription locataire, réservée aux invitations', function (): void {
    $this->postJson('/auth/register', inscription(['intended_profile' => 'tenant']))
        ->assertUnprocessable()
        ->assertJsonPath('errors.intended_profile.0', 'L\'inscription locataire se fait uniquement sur invitation.');

    expect(User::query()->count())->toBe(0);
});

it('accepte le profil voyageur', function (): void {
    $this->postJson('/auth/register', inscription(['intended_profile' => 'traveler']))->assertStatus(202);

    expect(User::query()->count())->toBe(1);
});

it('valide les champs en liste blanche et ignore les champs non prévus', function (): void {
    $this->postJson('/auth/register', inscription(['email_verified_at' => now()->toIso8601String(), 'id' => 999]))->assertStatus(202);

    $user = User::query()->sole();

    expect($user->id)->not->toBe(999)
        ->and($user->email_verified_at)->toBeNull();
});

it('journalise l\'inscription sans e-mail en clair', function (): void {
    $this->postJson('/auth/register', inscription())->assertStatus(202);

    expect(AuditLog::query()->where('action', 'auth.register.succeeded')->count())->toBe(1)
        ->and(AuditLog::query()->get()->toJson())->not->toContain('jeanne@exemple.fr');
});

it('limite l\'inscription par throttle:auth', function (): void {
    for ($i = 0; $i < 5; $i++) {
        $this->postJson('/auth/register', inscription())->assertStatus(202);
    }

    $this->postJson('/auth/register', inscription())->assertTooManyRequests();
});

it('renvoie des messages de validation lisibles en français, jamais une clé de traduction', function (): void {
    $this->postJson('/auth/register', inscription(['password' => 'court', 'password_confirmation' => 'court']))
        ->assertUnprocessable()
        ->assertJsonPath('errors.password.0', 'Le champ mot de passe doit contenir au moins 8 caractères.');
});

it('enregistre l\'intention d\'inscription du compte', function (): void {
    $this->postJson('/auth/register', inscription(['intended_profile' => 'individual_landlord']))->assertStatus(202);

    expect(User::query()->sole()->intended_profile?->value)->toBe('individual_landlord');
});
