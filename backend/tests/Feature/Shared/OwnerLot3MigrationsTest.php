<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

function migrationDuLot3(string $fichier): Migration
{
    return require base_path("app/Modules/{$fichier}");
}

it('retire ce que la migration des notifications propriétaire ajoute, puis la rejoue', function (): void {
    $migration = migrationDuLot3('Notifications/Database/Migrations/2026_11_19_420000_add_owner_audience_to_notifications_table.php');

    $migration->down();
    expect(Schema::hasColumn('notifications', 'party_id'))->toBeFalse();

    $migration->up();
    expect(Schema::hasColumn('notifications', 'party_id'))->toBeTrue();
});

it('retire la table des demandes de compte de paiement, puis la rejoue', function (): void {
    $migration = migrationDuLot3('OwnerFunds/Database/Migrations/2026_11_19_410000_create_payout_account_requests_table.php');

    $migration->down();
    expect(Schema::hasTable('payout_account_requests'))->toBeFalse();

    $migration->up();
    expect(Schema::hasTable('payout_account_requests'))->toBeTrue();
});
