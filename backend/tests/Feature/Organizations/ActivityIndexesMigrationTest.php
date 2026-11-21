<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Schema;

it('crée les deux index du journal sur SQLite par la voie normale', function (): void {
    $noms = array_column(Schema::getIndexes('audit_logs'), 'name');

    expect($noms)->toContain('audit_logs_org_actor_occurred_idx')->toContain('audit_logs_org_action_occurred_idx');
});

it('émet sous MySQL un seul ALTER sur place et sans verrou, qui échoue plutôt que de recopier la table', function (): void {
    $migration = require database_path('migrations/2026_11_21_700000_add_activity_indexes_to_audit_logs.php');
    $sql = $migration->mysqlStatement();

    expect($sql)->toStartWith('ALTER TABLE `audit_logs`')->toEndWith('ALGORITHM=INPLACE, LOCK=NONE')
        ->toContain('`audit_logs_org_actor_occurred_idx` (`organization_id`, `actor_user_id`, `occurred_at`)')
        ->toContain('`audit_logs_org_action_occurred_idx` (`organization_id`, `action`, `occurred_at`)')
        ->and(substr_count($sql, 'ALTER TABLE'))->toBe(1);
});
