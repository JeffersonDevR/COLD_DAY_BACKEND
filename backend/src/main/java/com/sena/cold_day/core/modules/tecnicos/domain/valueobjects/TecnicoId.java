package com.sena.cold_day.core.modules.tecnicos.domain.valueobjects;

import java.util.Objects;
import java.util.UUID;

public record TecnicoId(UUID valor) {

    public TecnicoId{
        Objects.requireNonNull(valor, "El identificador no puede ser nulo");
    }


    public static TecnicoId nueva(){
        return new TecnicoId(UUID.randomUUID());
    }

    public static TecnicoId desde(UUID valor){
        return new TecnicoId(valor);

    }

    public static TecnicoId desde(String valor){
        return new TecnicoId(UUID.fromString(valor));

    }

    @Override
    public String toString(){
        return valor.toString();
    }

}
