<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use App\Modules\Organizations\Notifications\MemberInvitationNotification;
use Illuminate\Support\Facades\DB;

beforeEach(function (): void {
    config(['queue.default' => 'database']);
});

it('ne laisse pas le jeton de réinitialisation en clair dans la file', function (): void {
    $user = User::factory()->create(['email' => 'jeanne@exemple.fr']);

    $user->sendPasswordResetNotification('jeton-secret-0123456789');

    $payload = (string) DB::table('jobs')->value('payload');

    expect(DB::table('jobs')->count())->toBe(1)
        ->and($payload)->not->toContain('jeton-secret-0123456789')
        ->and(json_decode($payload, true)['data']['command'])->not->toStartWith('O:');
});

it('envoie le lien de réinitialisation quand le job chiffré est exécuté', function (): void {
    $user = User::factory()->create(['email' => 'jeanne@exemple.fr']);

    $user->sendPasswordResetNotification('jeton-secret-0123456789');
    $this->artisan('queue:work', ['--once' => true, '--stop-when-empty' => true])->assertSuccessful();

    expect(DB::table('jobs')->count())->toBe(0)
        ->and(DB::table('failed_jobs')->count())->toBe(0);
});

it('ne laisse pas l\'URL d\'invitation en clair dans la file', function (): void {
    $user = User::factory()->create();

    $user->notify(new MemberInvitationNotification('Agence Test', 'Jean', 'https://hub.test/invitation?jeton=jeton-invitation-secret', null));

    $payload = (string) DB::table('jobs')->value('payload');

    expect($payload)->not->toContain('jeton-invitation-secret')
        ->and(json_decode($payload, true)['data']['command'])->not->toStartWith('O:');
});
