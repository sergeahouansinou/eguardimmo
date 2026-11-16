<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Schedule;

Schedule::command('sanctum:prune-expired --hours=24')->daily();
Schedule::command('identity:revoke-deferred-apple-tokens')->hourly()->withoutOverlapping();
Schedule::command('accounting:verify-ledger')->dailyAt('03:30')->withoutOverlapping();
Schedule::command('documents:sweep-orphans')->dailyAt('04:00')->withoutOverlapping();
Schedule::command('properties:verify-ownerships')->dailyAt('03:45')->withoutOverlapping();
Schedule::command('leases:verify')->dailyAt('03:50')->withoutOverlapping();
