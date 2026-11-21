<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;

it('ne publie aucune route de service ni de dépôt pour le disque privé', function (): void {
    expect(config('filesystems.disks.local.serve'))->toBeFalse()
        ->and(Route::has('storage.local'))->toBeFalse()
        ->and(Route::has('storage.local.upload'))->toBeFalse();

    $this->get('/storage/support/piece.pdf')->assertNotFound();
    $this->put('/storage/support/piece.pdf')->assertStatus(404);
});

it('garde le disque privé lisible et inscriptible par l\'application', function (): void {
    Storage::fake('local');

    Storage::disk('local')->put('support/piece.pdf', 'contenu');

    expect(Storage::disk('local')->get('support/piece.pdf'))->toBe('contenu');
});
