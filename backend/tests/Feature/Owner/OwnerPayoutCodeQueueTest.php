<?php

declare(strict_types=1);

use App\Modules\Identity\Models\User;
use App\Modules\OwnerFunds\Notifications\PayoutAccountCodeNotification;
use Illuminate\Support\Facades\DB;

beforeEach(function (): void {
    config(['queue.default' => 'database']);
});

it('ne laisse pas le code de confirmation en clair dans la file', function (): void {
    $compte = User::factory()->create(['email' => 'awa@exemple.fr']);

    $compte->notify(new PayoutAccountCodeNotification('482915', 15));

    $payload = (string) DB::table('jobs')->value('payload');

    expect(DB::table('jobs')->count())->toBe(1)
        ->and($payload)->not->toContain('482915')
        ->and(json_decode($payload, true)['data']['command'])->not->toStartWith('O:');
});

it('envoie le code quand le job chiffré est exécuté', function (): void {
    $compte = User::factory()->create(['email' => 'awa@exemple.fr']);

    $compte->notify(new PayoutAccountCodeNotification('482915', 15));
    $this->artisan('queue:work', ['--once' => true, '--stop-when-empty' => true])->assertSuccessful();

    expect(DB::table('jobs')->count())->toBe(0)->and(DB::table('failed_jobs')->count())->toBe(0);
});
