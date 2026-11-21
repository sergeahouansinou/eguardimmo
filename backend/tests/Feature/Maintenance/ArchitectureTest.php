<?php

declare(strict_types=1);

$modules = ['Accounting', 'Catalog', 'Documents', 'Identity', 'Leases', 'Mandates', 'Organizations', 'Parties', 'Properties'];
$interdits = array_values(array_map(fn (string $nom): string => "App\\Modules\\{$nom}", array_diff(
    ['Accounting', 'Catalog', 'Documents', 'Identity', 'Leases', 'Mandates', 'Organizations', 'Parties', 'Properties', 'Notifications', 'Rent', 'Invoicing', 'Recovery', 'Messaging', 'Reporting', 'Payments', 'Inspections', 'Marketplace'],
    $modules,
)));

arch('Maintenance ne dépend que des modules déclarés dans l\'ADR 0005, et jamais de Notifications')
    ->expect('App\Modules\Maintenance')
    ->not->toUse([...$interdits, 'App\Modules\Notifications']);

arch('les Actions de Maintenance sont des classes finales en lecture seule, une opération chacune')
    ->expect('App\Modules\Maintenance\Actions')
    ->toBeFinal()->toBeReadonly()->toHaveMethod('handle');

arch('les contrôleurs de Maintenance sont mono-action et sans logique métier directe sur les modèles')
    ->expect('App\Modules\Maintenance\Http\Controllers')
    ->toBeFinal()->toHaveMethod('__invoke')
    ->not->toUse(['Illuminate\Support\Facades\DB', 'Illuminate\Support\Facades\Mail']);

arch('les événements de Maintenance sont émis après validation de la transaction')
    ->expect('App\Modules\Maintenance\Events')
    ->toImplement('Illuminate\Contracts\Events\ShouldDispatchAfterCommit');

arch('les DTO de Maintenance sont immuables et ne touchent pas aux modèles')
    ->expect('App\Modules\Maintenance\Data')
    ->toBeFinal()->toBeReadonly()->not->toUse('App\Modules\Maintenance\Models');

arch('les ressources ne renvoient jamais un modèle brut et ne lisent pas la base')
    ->expect('App\Modules\Maintenance\Http\Resources')
    ->not->toUse('Illuminate\Support\Facades\DB');
