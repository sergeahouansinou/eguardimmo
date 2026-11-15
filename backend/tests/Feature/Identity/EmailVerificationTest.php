<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use App\Modules\Identity\Notifications\VerifyEmailNotification;
use App\Shared\Audit\AuditLog;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\URL;

function lienDeVerification(User $user): string
{
    return URL::temporarySignedRoute('verification.verify', now()->addMinutes(60), ['id' => $user->id, 'hash' => sha1($user->email)]);
}

it('vérifie l\'e-mail, révoque les jetons et audite', function (): void {
    $user = User::factory()->unverified()->create();
    $user->createToken('mobile', ['mobile']);

    $this->actingAs($user, 'web')->get(lienDeVerification($user))->assertRedirect();

    expect($user->refresh()->hasVerifiedEmail())->toBeTrue()
        ->and($user->tokens()->count())->toBe(0)
        ->and(AuditLog::query()->where('action', 'auth.email.verified')->where('actor_user_id', $user->id)->exists())->toBeTrue();
});

it('refuse un lien de vérification altéré ou destiné à un autre compte', function (): void {
    $user = User::factory()->unverified()->create();
    $autre = User::factory()->unverified()->create();

    $this->actingAs($user, 'web')->get(lienDeVerification($user).'x')->assertForbidden();
    $this->actingAs($user, 'web')->get(lienDeVerification($autre))->assertForbidden();

    expect($user->refresh()->hasVerifiedEmail())->toBeFalse()
        ->and($autre->refresh()->hasVerifiedEmail())->toBeFalse();
});

it('pointe le lien de l\'e-mail vers le hub', function (): void {
    Notification::fake();
    $user = User::factory()->unverified()->create();

    $user->sendEmailVerificationNotification();

    Notification::assertSentTo($user, VerifyEmailNotification::class, function (VerifyEmailNotification $n) use ($user): bool {
        $url = (string) $n->toMail($user)->actionUrl;

        return str_starts_with($url, 'https://auth.eguardimmo.test/verification-email/confirmer?jeton=https%3A%2F%2F');
    });
});
