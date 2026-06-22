<?php

namespace App\Models\Concerns;

use DateTimeInterface;

/**
 * Serializes every model date as ISO-8601 UTC with milliseconds and a trailing Z
 * (e.g. 2026-01-15T10:30:00.000Z) and uses camelCase createdAt/updatedAt columns,
 * matching the JSON-Server contract the frontend expects.
 *
 * The timestamp column names are overridden via the accessor methods (rather than
 * the CREATED_AT/UPDATED_AT constants) because PHP 8.4 forbids a trait redefining
 * a constant already declared on the composing Eloquent model.
 */
trait SerializesIsoDates
{
    public function getCreatedAtColumn(): string
    {
        return 'createdAt';
    }

    public function getUpdatedAtColumn(): string
    {
        return 'updatedAt';
    }

    protected function serializeDate(DateTimeInterface $date): string
    {
        return $date->setTimezone(new \DateTimeZone('UTC'))->format('Y-m-d\TH:i:s.v\Z');
    }
}
