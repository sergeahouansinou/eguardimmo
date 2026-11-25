<?php

declare(strict_types=1);

$interdits = ['Accounting', 'Catalog', 'Documents', 'Leases', 'Mandates', 'Parties', 'Properties', 'Rent', 'Invoicing', 'Recovery', 'Messaging', 'Reporting', 'Payments', 'Inspections', 'Maintenance', 'Planning', 'Notifications', 'Geography', 'Organizations'];

arch('Bookings ne dépend que de Listings (PublicApi) et d\'Identity (compte), et jamais des internes de Listings')
    ->expect('App\Modules\Bookings')
    ->not->toUse(array_map(fn (string $nom): string => "App\\Modules\\{$nom}", $interdits))
    ->not->toUse(['App\Modules\Listings\Models', 'App\Modules\Listings\Queries', 'App\Modules\Listings\Actions', 'App\Modules\Listings\Support', 'App\Modules\Listings\Http']);

arch('les contrôleurs de Bookings n\'accèdent pas à la base')
    ->expect('App\Modules\Bookings\Http\Controllers')
    ->not->toUse(['Illuminate\Support\Facades\DB', 'App\Modules\Bookings\Models']);

arch('les ressources de Bookings ne lisent ni la base ni un modèle')
    ->expect('App\Modules\Bookings\Http\Resources')
    ->not->toUse(['Illuminate\Support\Facades\DB', 'App\Modules\Bookings\Models']);

arch('les actions de Bookings sont finales et en lecture seule')
    ->expect('App\Modules\Bookings\Actions')
    ->toBeFinal()->toBeReadonly();

arch('les événements de Bookings partent après validation de la transaction')
    ->expect('App\Modules\Bookings\Events')
    ->toImplement('Illuminate\Contracts\Events\ShouldDispatchAfterCommit');

arch('aucun montant à virgule flottante dans Bookings')
    ->expect('App\Modules\Bookings')
    ->not->toUse(['floatval', 'round', 'floor', 'ceil']);
